use nostr::EventId;
use serde::Deserialize;
use serde::Serialize;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[repr(u8)]
pub enum DephyGachaStatus {
    Available = 1,
    Working = 2,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[repr(u8)]
pub enum DephyGachaStatusReason {
    UserRequest = 1,
    AdminRequest = 2,
    UserBehaviour = 3,
    Reset = 4,
    LockFailed = 5,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DephyGachaMessage {
    Request {
        to_status: DephyGachaStatus,
        reason: DephyGachaStatusReason,
        initial_request: EventId,
        payload: String,
    },
    Status {
        status: DephyGachaStatus,
        reason: DephyGachaStatusReason,
        initial_request: EventId,
        payload: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DephyGachaMessageRequestPayload {
    pub user: String,
    pub nonce: u64,
    pub recover_info: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DephyGachaMessageStatusPayload {
    pub user: String,
    pub nonce: u64,
    pub recover_info: String,
}
