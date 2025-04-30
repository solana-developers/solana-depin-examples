use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct UserAccount {
    pub nonce: u64,
    pub locked_amount: u64,
    pub vault: Pubkey,
}
