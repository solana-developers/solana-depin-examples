use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;
pub mod utils;

use instructions::*;

declare_id!("GguVKxU88NUe3GLtns7Uaa6a8Pjb9USKq3WD1rjZnPS9");

#[program]
pub mod balance_payment {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        instructions::initialize(ctx)
    }

    pub fn set_bot(ctx: Context<SetBot>) -> Result<()> {
        instructions::set_bot(ctx)
    }

    pub fn set_treasury(ctx: Context<SetTreasury>) -> Result<()> {
        instructions::set_treasury(ctx)
    }

    pub fn register(ctx: Context<Register>) -> Result<()> {
        instructions::register(ctx)
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        instructions::deposit(ctx, amount)
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        instructions::withdraw(ctx, amount)
    }

    pub fn lock(ctx: Context<Lock>, recover_info: ED25519RecoverInfo, amount: u64) -> Result<()> {
        instructions::lock(ctx, recover_info, amount)
    }

    pub fn settle(ctx: Context<Settle>, _nonce: u64, amount_to_transfer: u64) -> Result<()> {
        instructions::settle(ctx, _nonce, amount_to_transfer)
    }

    pub fn pay(ctx: Context<Pay>, recover_info: ED25519RecoverInfo, amount_to_transfer: u64) -> Result<()> {
        instructions::pay(ctx, recover_info, amount_to_transfer)
    }
}
