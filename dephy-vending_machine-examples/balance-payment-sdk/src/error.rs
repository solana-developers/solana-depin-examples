#[derive(Debug, thiserror::Error)]
#[non_exhaustive]
pub enum Error {
    #[error("Io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Parse pubkey error: ")]
    ParsePubkey(#[from] solana_program::pubkey::ParsePubkeyError),
    #[error("Serde json error: {0}")]
    SerdeJson(#[from] serde_json::Error),
    #[error("Solana client error: {0}")]
    SolanaClient(#[from] solana_client::client_error::ClientError),
    #[error("Signature verification failed: {0}")]
    SignatureVerificationFailed(String),
    #[error("Keypair read failed: {0}")]
    KeypairReadFailed(Box<dyn std::error::Error>),
}
