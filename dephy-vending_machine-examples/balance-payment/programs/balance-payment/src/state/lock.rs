use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct LockAccount {
    pub amount: u64,
}
