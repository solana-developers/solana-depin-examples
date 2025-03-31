use nostr::Event;
use nostr::PublicKey;
use nostr::RelayMessage;
use nostr::Timestamp;
use nostr_sdk::RelayPoolNotification;
use tokio::sync::oneshot;

use crate::message::DephyDechargeMessage;
use crate::message::DephyDechargeMessageStatusPayload;
use crate::message::DephyDechargeStatus;
use crate::message::DephyDechargeStatusReason;
use crate::relay_client::extract_mention;
use crate::server::State;
use crate::RelayClient;

/// MAX_DEVIATION_SECONDS * 4
/// MAX_DEVIATION_SECONDS is from dephy_messaging_network crate.
const TIME_BACKTRACE_OF_INITIAL_RETRIEVE: std::time::Duration =
    std::time::Duration::from_secs(30 * 4);

const PREPAID_AMOUNT: u64 = 10_000_000;
const TRANSFER_AMOUNT: u64 = 5_000_000;

#[derive(Debug, thiserror::Error)]
#[non_exhaustive]
pub enum Error {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Server state error: {0}")]
    State(#[from] crate::server::state::Error),
    #[error("Serde json error: {0}")]
    SerdeJson(#[from] serde_json::Error),
    #[error("Nostr key error: {0}")]
    NostrKey(#[from] nostr::key::Error),
    #[error("Relay client error: {0}")]
    RelayClient(#[from] crate::relay_client::Error),
}

pub struct MessageHandler {
    client: RelayClient,
    state: State,
    solana_rpc_url: String,
    solana_keypair_path: String,
    initial_notifier: Option<oneshot::Sender<()>>,
}

impl MessageHandler {
    pub fn new(
        client: RelayClient,
        state: State,
        solana_rpc_url: &str,
        solana_keypair_path: &str,
        initial_notifier: Option<oneshot::Sender<()>>,
    ) -> Self {
        Self {
            client,
            state,
            solana_rpc_url: solana_rpc_url.to_string(),
            solana_keypair_path: solana_keypair_path.to_string(),
            initial_notifier,
        }
    }

    pub async fn run(mut self) {
        let last_processed_event = self
            .state
            .db_get_last_processed_event()
            .await
            .expect("Failed to get last processed event");

        let since = last_processed_event.as_ref().map(|event| {
            Timestamp::from_secs(event.created_at as u64) - TIME_BACKTRACE_OF_INITIAL_RETRIEVE
        });
        let last_event_id = last_processed_event.map(|event| event.event_id);

        let mut notifications = self.client.notifications();
        self.client
            .subscribe_all(since)
            .await
            .expect("Failed to subscribe events");

        let checking_client = self.client.clone();
        let relay_checker = async move {
            checking_client
                .run_relay_checker(std::time::Duration::from_secs(10))
                .await
        };

        let message_handler = async move {
            let mut reached_last_event = last_event_id.is_none();

            loop {
                let notification = notifications
                    .recv()
                    .await
                    .expect("Failed to receive notification");
                tracing::debug!("Received notification: {:?}", notification);

                match notification {
                    RelayPoolNotification::Shutdown => panic!("Relay pool shutdown"),
                    RelayPoolNotification::Message {
                        message: RelayMessage::Closed { message, .. },
                        ..
                    } => {
                        tracing::error!("Subscription closed: {}", message);
                        panic!("Subscription closed: {message}");
                    }
                    RelayPoolNotification::Message {
                        message: RelayMessage::EndOfStoredEvents { .. },
                        ..
                    } => {
                        if !reached_last_event {
                            tracing::error!(
                                "Not reached last processed event: {last_event_id:?}, but received end of stored events"
                            );
                            panic!("Not reached last processed event");
                        }

                        tracing::info!("End of stored events, notifying the checker");

                        let Some(notifier) = self.initial_notifier.take() else {
                            tracing::info!("No initial_notifier found, will skip notifying");
                            continue;
                        };

                        notifier.send(()).expect("Failed to notify checker start");
                    }
                    RelayPoolNotification::Message {
                        message: RelayMessage::Event { event, .. },
                        ..
                    } => {
                        if !reached_last_event {
                            let last_event_id = last_event_id.as_deref().unwrap();

                            if event.id.to_hex() == last_event_id {
                                tracing::info!(
                                    "Reached last processed event: {last_event_id}, start handling events"
                                );
                                reached_last_event = true;
                            }

                            continue;
                        }

                        let Ok(message) =
                            serde_json::from_str::<DephyDechargeMessage>(&event.content)
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
        &self,
        event: &Event,
        message: &DephyDechargeMessage,
    ) -> Result<(), Error> {
        tracing::debug!("Handling message: {:?}", message);
        let received_id = self
            .state
            .db_record_received_event(&event.id.to_hex(), event.created_at.as_u64() as i64)
            .await?;

        match message {
            DephyDechargeMessage::Status {
                status: DephyDechargeStatus::Working,
                reason: DephyDechargeStatusReason::UserRequest,
                initial_request,
                payload,
            } => {
                let Some(mention) = extract_mention(event) else {
                    tracing::error!("Machine not mentioned in event, skip event: {:?}", event);
                    return Ok(());
                };

                if PublicKey::parse(mention).is_err() {
                    tracing::error!("Failed to parse machine pubkey, skip event: {:?}", mention);
                    return Ok(());
                };

                let parsed_payload =
                    serde_json::from_str::<DephyDechargeMessageStatusPayload>(payload)?;

                if let Err(e) = dephy_balance_payment_sdk::lock(
                    &self.solana_rpc_url,
                    &self.solana_keypair_path,
                    &parsed_payload.user,
                    PREPAID_AMOUNT,
                    &parsed_payload.recover_info,
                )
                .await
                {
                    tracing::error!("Failed to lock error: {:?} event: {:?}", e, event);

                    self.client
                        .send_event(mention, &DephyDechargeMessage::Request {
                            to_status: DephyDechargeStatus::Available,
                            reason: DephyDechargeStatusReason::LockFailed,
                            initial_request: *initial_request,
                            payload: payload.to_string(),
                        })
                        .await?
                }
            }
            DephyDechargeMessage::Status {
                status: DephyDechargeStatus::Available,
                reason: DephyDechargeStatusReason::UserBehaviour,
                payload,
                ..
            } => {
                let Some(mention) = extract_mention(event) else {
                    tracing::error!("Machine not mentioned in event, skip event: {:?}", event);
                    return Ok(());
                };

                if PublicKey::parse(mention).is_err() {
                    tracing::error!("Failed to parse machine pubkey, skip event: {:?}", mention);
                    return Ok(());
                };

                let parsed_payload =
                    serde_json::from_str::<DephyDechargeMessageStatusPayload>(payload)?;

                if let Err(e) = dephy_balance_payment_sdk::settle(
                    &self.solana_rpc_url,
                    &self.solana_keypair_path,
                    &parsed_payload.user,
                    parsed_payload.nonce,
                    TRANSFER_AMOUNT,
                )
                .await
                {
                    tracing::error!("Failed to settle error: {:?} event: {:?}", e, event);
                }
            }
            _ => {}
        }

        self.state.db_record_event_processed(received_id).await?;

        Ok(())
    }
}
