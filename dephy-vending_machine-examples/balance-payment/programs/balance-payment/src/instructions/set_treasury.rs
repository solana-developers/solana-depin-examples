use crate::errors::CustomError;
use crate::state::GlobalAccount;
use anchor_lang::prelude::*;

pub fn set_treasury(ctx: Context<SetTreasury>) -> Result<()> {
    let global_account = &mut ctx.accounts.global_account;
    global_account.treasury = ctx.accounts.treasury.key();
    Ok(())
}

#[derive(Accounts)]
pub struct SetTreasury<'info> {
    #[account(mut, has_one = authority @ CustomError::Unauthorized, seeds = [b"GLOBAL"], bump)]
    pub global_account: Account<'info, GlobalAccount>,
    pub authority: Signer<'info>,
    /// CHECK:
    #[account(constraint = treasury.data_is_empty())]
    pub treasury: UncheckedAccount<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
}
