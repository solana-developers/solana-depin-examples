use crate::errors::CustomError;
use crate::state::GlobalAccount;
use anchor_lang::prelude::*;

pub fn set_bot(ctx: Context<SetBot>) -> Result<()> {
    let global_account = &mut ctx.accounts.global_account;
    global_account.bot = ctx.accounts.bot.key();
    Ok(())
}

#[derive(Accounts)]
pub struct SetBot<'info> {
    #[account(mut, has_one = authority @ CustomError::Unauthorized, seeds = [b"GLOBAL"], bump)]
    pub global_account: Account<'info, GlobalAccount>,
    pub authority: Signer<'info>,
    /// CHECK:
    #[account(constraint = bot.data_is_empty())]
    pub bot: UncheckedAccount<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
}
