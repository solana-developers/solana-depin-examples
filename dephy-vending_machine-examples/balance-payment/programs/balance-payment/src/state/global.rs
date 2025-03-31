use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct GlobalAccount {
    pub authority: Pubkey,
    pub bot: Pubkey,
    pub treasury: Pubkey,
}
