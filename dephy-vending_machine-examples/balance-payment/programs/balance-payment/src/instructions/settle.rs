use crate::{
    errors::CustomError,
    state::{GlobalAccount, LockAccount, UserAccount},
};
use anchor_lang::{prelude::*, system_program};

pub fn settle(ctx: Context<Settle>, _nonce: u64, amount_to_transfer: u64) -> Result<()> {
    let user_account = &mut ctx.accounts.user_account;
    let lock_account = &mut ctx.accounts.lock_account;

    require!(
        lock_account.amount >= amount_to_transfer,
        CustomError::InsufficientFunds
    );

    user_account.locked_amount -= lock_account.amount;

    system_program::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
            },
            &[&[
                b"VAULT",
                ctx.accounts.user.key().as_ref(),
                &[ctx.bumps.vault],
            ]],
        ),
        amount_to_transfer,
    )?;

    // Close the lock account and transfer the rent to the payer
    let lock_account_info = lock_account.to_account_info();
    let payer_info = ctx.accounts.payer.to_account_info();
    let rent = Rent::get()?;
    let lamports = rent.minimum_balance(lock_account_info.data_len());

    **lock_account_info.lamports.borrow_mut() -= lamports;
    **payer_info.lamports.borrow_mut() += lamports;

    lock_account_info.assign(&system_program::ID);
    lock_account_info.realloc(0, false)?;

    Ok(())
}

#[derive(Accounts)]
#[instruction(nonce: u64)]
pub struct Settle<'info> {
    #[account(has_one = bot @ CustomError::Unauthorized, seeds = [b"GLOBAL"], bump)]
    pub global_account: Account<'info, GlobalAccount>,
    #[account(mut, seeds = [b"USER", user.key.as_ref()], bump)]
    pub user_account: Account<'info, UserAccount>,
    /// CHECK:
    #[account(mut)]
    pub user: UncheckedAccount<'info>,
    /// CHECK:
    #[account(mut, constraint = treasury.key() == global_account.treasury)]
    pub treasury: UncheckedAccount<'info>,
    #[account(
        mut,
        seeds = [b"LOCK", user.key().as_ref(), nonce.to_le_bytes().as_ref()],
        bump,
    )]
    pub lock_account: Account<'info, LockAccount>,
    /// CHECK:
    #[account(mut, seeds = [b"VAULT", user.key().as_ref()], bump)]
    pub vault: UncheckedAccount<'info>,
    pub bot: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}
