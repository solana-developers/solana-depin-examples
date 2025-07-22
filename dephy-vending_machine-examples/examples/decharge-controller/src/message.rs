use nostr::EventId;
use serde::Deserialize;
use serde::Serialize;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[repr(u8)]
pub enum DephyDechargeStatus {
    Available = 1,
    Working = 2,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[repr(u8)]
pub enum DephyDechargeStatusReason {
    UserRequest = 1,
    AdminRequest = 2,
    UserBehaviour = 3,
    LockFailed = 5,
    Reset = 4,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DephyDechargeMessage {
    Request {
        to_status: DephyDechargeStatus,
        reason: DephyDechargeStatusReason,
        initial_request: EventId,
        payload: String,
    },
    Status {
        status: DephyDechargeStatus,
        reason: DephyDechargeStatusReason,
        initial_request: EventId,
        payload: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DephyDechargeMessageRequestPayload {
    pub user: String,
    pub nonce: u64,
    pub recover_info: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DephyDechargeMessageStatusPayload {
    pub user: String,
    pub nonce: u64,
    pub recover_info: String,
}
