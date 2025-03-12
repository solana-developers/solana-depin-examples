use crate::state::UserAccount;
use anchor_lang::{prelude::*, system_program};

pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    system_program::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.user.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
            &[],
        ),
        amount,
    )?;

    Ok(())
}


#[derive(Accounts)]
pub struct Deposit<'info> {
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
