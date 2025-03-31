use std::collections::HashMap;
use std::collections::HashSet;

use nostr::Event;
use nostr::EventId;
use nostr::PublicKey;
use nostr::RelayMessage;
use nostr::Timestamp;
use nostr_sdk::RelayPoolNotification;

use crate::message::DephyGachaMessage;
use crate::message::DephyGachaMessageRequestPayload;
use crate::message::DephyGachaMessageStatusPayload;
use crate::message::DephyGachaStatus;
use crate::message::DephyGachaStatusReason;
use crate::relay_client::extract_mention;
use crate::RelayClient;

const PAY_AMOUNT: u64 = 5_000_000;

#[derive(Debug, thiserror::Error)]
#[non_exhaustive]
pub enum Error {
    #[error("Serde json error: {0}")]
    SerdeJson(#[from] serde_json::Error),
    #[error("Nostr key error: {0}")]
    NostrKey(#[from] nostr::key::Error),
    #[error("Relay client error: {0}")]
    RelayClient(#[from] crate::relay_client::Error),
    #[error("Machine not mentioned in event: {0:?}")]
    MachineNotMentioned(Event),
    #[error("The machine mentioned by event is not controlled by us: {0:?}")]
    MachineNotControlled(Event),
    #[error("Only support status event when update machine, but got: {0:?}")]
    OnlySupportStatusEventWhenUpdateMachine(Event),
}

pub struct Machine {
    #[allow(dead_code)]
    pubkey: PublicKey,
    status: DephyGachaStatus,
    initial_request: Option<EventId>,
}

pub struct MessageHandler {
    client: RelayClient,
    solana_rpc_url: String,
    solana_keypair_path: String,
    controller_pubkey: PublicKey,
    admin_pubkey: PublicKey,
    machines: HashMap<PublicKey, Machine>,
    started_at: Timestamp,
}

impl MessageHandler {
    pub fn new(
        client: RelayClient,
        solana_rpc_url: &str,
        solana_keypair_path: &str,
        controller_pubkey: PublicKey,
        admin_pubkey: PublicKey,
        machine_pubkeys: HashSet<PublicKey>,
    ) -> Self {
        let started_at = Timestamp::now();
        let machines = machine_pubkeys
            .into_iter()
            .map(|pubkey| {
                (pubkey, Machine {
                    pubkey,
                    status: DephyGachaStatus::Available,
                    initial_request: None,
                })
            })
            .collect();

        Self {
            client,
            solana_rpc_url: solana_rpc_url.to_string(),
            solana_keypair_path: solana_keypair_path.to_string(),
            controller_pubkey,
            admin_pubkey,
            machines,
            started_at,
        }
    }

    pub async fn update_machine(&mut self, event: &Event) -> Result<(), Error> {
        let mention = PublicKey::parse(
            extract_mention(event).ok_or_else(|| Error::MachineNotMentioned(event.clone()))?,
        )?;

        let machine = self
            .machines
            .get_mut(&mention)
            .ok_or_else(|| Error::MachineNotControlled(event.clone()))?;

        let message = serde_json::from_str::<DephyGachaMessage>(&event.content)?;

        match message {
            DephyGachaMessage::Request { .. } => {
                return Err(Error::OnlySupportStatusEventWhenUpdateMachine(
                    event.clone(),
                ))
            }

            DephyGachaMessage::Status {
                status,
                initial_request,
                ..
            } => {
                machine.status = status;
                machine.initial_request = Some(initial_request);
            }
        }

        Ok(())
    }

    pub async fn run(mut self) {
        let mut notifications = self.client.notifications();

        let checking_client = self.client.clone();
        let relay_checker = async move {
            checking_client
                .run_relay_checker(std::time::Duration::from_secs(10))
                .await
        };

        let message_handler = async move {
            let mut sub_ids = HashMap::new();

            for machine_pubkey in self.machines.keys().copied() {
                let sub_id = self
                    .client
                    .subscribe_last_event(
                        self.started_at,
                        Some(&self.controller_pubkey),
                        &machine_pubkey,
                    )
                    .await
                    .expect("Failed to subscribe events");

                sub_ids.insert(sub_id, machine_pubkey);
            }

            while !sub_ids.is_empty() {
                let notification = notifications
                    .recv()
                    .await
                    .expect("Failed to receive notification");
                tracing::debug!("Received notification: {:?}", notification);

                match notification {
                    RelayPoolNotification::Shutdown => panic!("Relay pool shutdown"),

                    RelayPoolNotification::Message {
                        message:
                            RelayMessage::Closed {
                                message,
                                subscription_id,
                            },
                        ..
                    } => {
                        if sub_ids.contains_key(&subscription_id) {
                            tracing::error!(
                                "Subscription closed before EndOfStoredEvents: {}",
                                message
                            );
                            panic!("Subscription closed before EndOfStoredEvents: {message}");
                        }
                    }

                    RelayPoolNotification::Message {
                        message: RelayMessage::EndOfStoredEvents(subscription_id),
                        ..
                    } => {
                        sub_ids.remove(&subscription_id);
                    }

                    RelayPoolNotification::Message {
                        message: RelayMessage::Event { event, .. },
                        ..
                    } => {
                        self.update_machine(&event)
                            .await
                            .expect("Failed to update machine");
                    }

                    _ => {}
                }
            }

            let sub_id = self
                .client
                .subscribe(self.started_at, self.machines.keys().cloned())
                .await
                .expect("Failed to subscribe events");

            loop {
                let notification = notifications
                    .recv()
                    .await
                    .expect("Failed to receive notification");
                tracing::debug!("Received notification: {:?}", notification);

                match notification {
                    RelayPoolNotification::Shutdown => panic!("Relay pool shutdown"),

                    RelayPoolNotification::Message {
                        message:
                            RelayMessage::Closed {
                                message,
                                subscription_id,
                            },
                        ..
                    } if subscription_id == sub_id => {
                        tracing::error!("Subscription closed: {}", message);
                        panic!("Subscription closed: {message}");
                    }

                    RelayPoolNotification::Message {
                        message: RelayMessage::EndOfStoredEvents(subscription_id),
                        ..
                    } if subscription_id == sub_id => {}

                    RelayPoolNotification::Message {
                        message:
                            RelayMessage::Event {
                                event,
                                subscription_id,
                            },
                        ..
                    } if subscription_id == sub_id => {
                        let Ok(message) = serde_json::from_str::<DephyGachaMessage>(&event.content)
                        else {
                            tracing::error!("Failed to parse message: {:?}", event);
                            continue;
                        };

                        self.handle_message(&event, &message)
                            .await
                            .expect("Failed to handle message");
                    }

                    _ => {}
                }
            }
        };

        futures::join!(relay_checker, message_handler);
    }

    async fn handle_message(
        &mut self,
        event: &Event,
        message: &DephyGachaMessage,
    ) -> Result<(), Error> {
        match message {
            DephyGachaMessage::Request {
                to_status,
                initial_request,
                reason,
                payload,
            } => {
                if event.pubkey != self.admin_pubkey
                    && *reason != DephyGachaStatusReason::UserRequest
                {
                    tracing::error!(
                        "User can only use reason UserRequest, skip event: {:?}",
                        event
                    );
                }

                let Some(mention) = extract_mention(event) else {
                    tracing::error!("Machine not mentioned in event, skip event: {:?}", event);
                    return Ok(());
                };

                let Ok(machine_pubkey) = PublicKey::parse(mention) else {
                    tracing::error!("Failed to parse machine pubkey, skip event: {:?}", mention);
                    return Ok(());
                };

                let Some(machine) = self.machines.get(&machine_pubkey) else {
                    tracing::error!("Machine not controlled by us, skip event: {:?}", mention);
                    return Ok(());
                };

                if machine.status == *to_status {
                    tracing::error!(
                        "Machine already in requested status, skip event: {:?}",
                        event
                    );
                    return Ok(());
                }

                if *to_status == DephyGachaStatus::Available {
                    if *reason == DephyGachaStatusReason::UserRequest {
                        tracing::error!(
                            "User cannot manually stop machine, skip event: {:?}",
                            event
                        );
                        return Ok(());
                    }

                    if let Some(ref original_request) = machine.initial_request {
                        if original_request != initial_request {
                            tracing::error!(
                                "Machine already in working status with different request, skip event: {:?}",
                                event
                            );
                            return Ok(());
                        }
                    }
                }

                let Ok(parsed_payload) =
                    serde_json::from_str::<DephyGachaMessageRequestPayload>(payload)
                else {
                    tracing::error!("Failed to parse payload, skip event: {:?}", payload);
                    return Ok(());
                };

                if let Err(e) = dephy_balance_payment_sdk::pay(
                    &self.solana_rpc_url,
                    &self.solana_keypair_path,
                    &parsed_payload.user,
                    PAY_AMOUNT,
                    &parsed_payload.recover_info,
                )
                .await
                {
                    tracing::error!("Failed to pay, error: {:?} skip event: {:?}", e, event);
                    return Ok(());
                };

                self.client
                    .send_event(mention, &DephyGachaMessage::Status {
                        status: *to_status,
                        reason: *reason,
                        initial_request: event.id,
                        payload: serde_json::to_string(&DephyGachaMessageStatusPayload {
                            user: parsed_payload.user.clone(),
                            nonce: parsed_payload.nonce,
                            recover_info: parsed_payload.recover_info.clone(),
                        })?,
                    })
                    .await?;

                // TODO: Should check this by machine api
                if *to_status == DephyGachaStatus::Working {
                    let client = self.client.clone();
                    let mention = mention.to_string();
                    let event_id = event.id;
                    tokio::spawn(async move {
                        tokio::time::sleep(std::time::Duration::from_secs(10)).await;
                        client
                            .send_event(&mention, &DephyGachaMessage::Status {
                                status: DephyGachaStatus::Available,
                                reason: DephyGachaStatusReason::UserBehaviour,
                                initial_request: event_id,
                                payload: serde_json::to_string(&DephyGachaMessageStatusPayload {
                                    user: parsed_payload.user.clone(),
                                    nonce: parsed_payload.nonce,
                                    recover_info: parsed_payload.recover_info,
                                })
                                .unwrap(),
                            })
                            .await
                            .unwrap();
                    });
                }
            }
            DephyGachaMessage::Status { .. } => self.update_machine(event).await?,
        }
        Ok(())
    }
}
