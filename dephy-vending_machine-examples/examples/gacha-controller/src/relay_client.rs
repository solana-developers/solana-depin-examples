use nostr::Event;
use nostr::EventBuilder;
use nostr::Filter;
use nostr::Keys;
use nostr::PublicKey;
use nostr::SingleLetterTag;
use nostr::SubscriptionId;
use nostr::Tag;
use nostr::Timestamp;
use nostr_sdk::prelude::ReqExitPolicy;
use nostr_sdk::Client;
use nostr_sdk::RelayPoolNotification;
use nostr_sdk::RelayStatus;
use nostr_sdk::SubscribeAutoCloseOptions;
use tokio::sync::broadcast::Receiver;

const EVENT_KIND: nostr::Kind = nostr::Kind::Custom(1573);
const MENTION_TAG: SingleLetterTag = SingleLetterTag::lowercase(nostr::Alphabet::P);
const SESSION_TAG: SingleLetterTag = SingleLetterTag::lowercase(nostr::Alphabet::S);

#[derive(Debug, thiserror::Error)]
#[non_exhaustive]
pub enum Error {
    #[error("Nostr client error: {0}")]
    NostrClient(#[from] nostr_sdk::client::Error),
    #[error("Serde json error: {0}")]
    SerdeJson(#[from] serde_json::Error),
    #[error("Send event error: {0}")]
    SendEvent(String),
}

#[derive(Clone)]
pub struct RelayClient {
    client: Client,
    session: String,
}

impl RelayClient {
    pub async fn new(
        nostr_relay: &str,
        keys: &Keys,
        session: &str,
        max_notification_size: usize,
    ) -> Result<Self, Error> {
        let client_opts =
            nostr_sdk::Options::default().notification_channel_size(max_notification_size);

        let client = Client::builder()
            .signer(keys.clone())
            .opts(client_opts)
            .build();

        client.add_relay(nostr_relay).await?;
        client.connect().await;

        Ok(Self {
            client,
            session: session.to_string(),
        })
    }

    pub async fn run_relay_checker(self, interval: std::time::Duration) {
        loop {
            tokio::time::sleep(interval).await;

            let connected_relay_count = self
                .client
                .relays()
                .await
                .values()
                .filter(|relay| relay.status() == RelayStatus::Connected)
                .count();

            if connected_relay_count == 0 {
                panic!("Lost connection to relay");
            }
        }
    }

    pub fn notifications(&self) -> Receiver<RelayPoolNotification> {
        self.client.notifications()
    }

    pub async fn subscribe_last_event(
        &self,
        until: Timestamp,
        author: Option<&PublicKey>,
        mention: &PublicKey,
    ) -> Result<SubscriptionId, Error> {
        let mut filter = Filter::new();

        filter = filter
            .kind(EVENT_KIND)
            .until(until)
            .custom_tag(SESSION_TAG, [&self.session])
            .custom_tag(MENTION_TAG, [mention.to_hex()])
            .limit(1);

        if let Some(author) = author {
            filter = filter.author(*author)
        }

        let close_option =
            SubscribeAutoCloseOptions::default().exit_policy(ReqExitPolicy::ExitOnEOSE);
        let output = self
            .client
            .subscribe(vec![filter], Some(close_option))
            .await?;

        Ok(output.id().clone())
    }

    pub async fn subscribe<I>(
        &self,
        since: Timestamp,
        mentions: I,
    ) -> Result<SubscriptionId, Error>
    where
        I: IntoIterator<Item = PublicKey>,
    {
        let filter = Filter::new()
            .kind(EVENT_KIND)
            .since(since)
            .custom_tag(SESSION_TAG, [&self.session])
            .custom_tag(MENTION_TAG, mentions.into_iter().map(|pk| pk.to_hex()));

        let output = self.client.subscribe(vec![filter], None).await?;

        Ok(output.id().clone())
    }

    pub async fn subscribe_all(&self, since: Option<Timestamp>) -> Result<SubscriptionId, Error> {
        let mut filter = Filter::new()
            .kind(EVENT_KIND)
            .custom_tag(SESSION_TAG, [&self.session]);

        if let Some(since) = since {
            filter = filter.since(since);
        }

        let output = self.client.subscribe(vec![filter], None).await?;

        Ok(output.id().clone())
    }

    pub async fn send_event<M>(&self, to: &str, message: &M) -> Result<(), Error>
    where M: serde::Serialize + std::fmt::Debug {
        let content = serde_json::to_string(message)?;

        let event_builder = EventBuilder::new(EVENT_KIND, content).tags([
            Tag::parse(["s".to_string(), self.session.clone()]).unwrap(),
            Tag::parse(["p".to_string(), to.to_string()]).unwrap(),
        ]);

        let res = self.client.send_event_builder(event_builder).await?;

        if !res.failed.is_empty() {
            for (relay_url, err) in res.failed.iter() {
                tracing::error!("failed to send event to {} err: {:?}", relay_url, err);
            }
            return Err(Error::SendEvent(format!(
                "Failed to send event {message:?} to relay"
            )));
        }

        Ok(())
    }
}

pub fn extract_mention(event: &Event) -> Option<&str> {
    event
        .tags
        .iter()
        .filter_map(|tag| {
            if tag.single_letter_tag() == Some(MENTION_TAG) {
                tag.content()
            } else {
                None
            }
        })
        .next()
}
