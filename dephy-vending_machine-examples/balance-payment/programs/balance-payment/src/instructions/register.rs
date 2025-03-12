use crate::constants::DISCRIMINATOR_SIZE;
use crate::state::UserAccount;
use anchor_lang::prelude::*;

pub fn register(ctx: Context<Register>) -> Result<()> {
    let user_account = &mut ctx.accounts.user_account;
    user_account.nonce = 0;
    user_account.locked_amount = 0;
    user_account.vault = ctx.accounts.vault.key();
    Ok(())
}

#[derive(Accounts)]
pub struct Register<'info> {
    #[account(init, payer = payer, space = DISCRIMINATOR_SIZE + UserAccount::INIT_SPACE, seeds = [b"USER", user.key.as_ref()], bump)]
    pub user_account: Account<'info, UserAccount>,
    pub user: Signer<'info>,
    /// CHECK: vault is only used for store SOL
    #[account(constraint = vault.data_is_empty(), seeds = [b"VAULT", user.key().as_ref()], bump)]
    pub vault: UncheckedAccount<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}
