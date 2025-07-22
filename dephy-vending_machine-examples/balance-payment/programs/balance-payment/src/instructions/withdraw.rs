use crate::{errors::CustomError, state::UserAccount};
use anchor_lang::{prelude::*, system_program};

pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    let available_balance =
        ctx.accounts.vault.get_lamports() - ctx.accounts.user_account.locked_amount;
    require!(available_balance >= amount, CustomError::InsufficientFunds);

    system_program::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.user.to_account_info(),
            },
            &[&[
                b"VAULT",
                ctx.accounts.user.key().as_ref(),
                &[ctx.bumps.vault],
            ]],
        ),
        amount,
    )?;

    Ok(())
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut, seeds = [b"USER", user.key.as_ref()], bump)]
    pub user_account: Account<'info, UserAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    /// CHECK:
    #[account(mut, seeds = [b"VAULT", user.key().as_ref()], bump)]
    pub vault: UncheckedAccount<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}
