use crate::constants::DISCRIMINATOR_SIZE;
use crate::state::GlobalAccount;
use anchor_lang::prelude::*;

pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
    let global_account = &mut ctx.accounts.global_account;
    global_account.authority = ctx.accounts.authority.key();
    global_account.bot = ctx.accounts.bot.key();
    global_account.treasury = ctx.accounts.treasury.key();
    Ok(())
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = payer, space = DISCRIMINATOR_SIZE + GlobalAccount::INIT_SPACE, seeds = [b"GLOBAL"], bump)]
    pub global_account: Account<'info, GlobalAccount>,
    /// CHECK:
    #[account(constraint = authority.data_is_empty())]
    pub authority: UncheckedAccount<'info>,
    /// CHECK:
    #[account(constraint = treasury.data_is_empty())]
    pub treasury: UncheckedAccount<'info>,
    /// CHECK:
    #[account(constraint = bot.data_is_empty())]
    pub bot: UncheckedAccount<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}
