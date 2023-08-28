use anchor_lang::solana_program::native_token::LAMPORTS_PER_SOL;
use anchor_lang::system_program;
use anchor_lang::{prelude::*, solana_program::pubkey};

declare_id!("GCgyx9JPNpqX97iWQh7rqPjaignahkS8DqQGdDdfXsPQ");
const TREASURE_PUBKEY: Pubkey = pubkey!("GsfNSuZFrT2r4xzSndnCSs9tTXwt47etPqU8yFVnDcXd");

#[error_code]
pub enum ShotErrorCode {
    #[msg("InvalidTreasury")]
    InvalidTreasury,
}

#[program]
pub mod solana_bar {

    use super::*;
    const SHOT_PRICE: u64 = LAMPORTS_PER_SOL / 10; // 0.1 SOL

    pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }

    pub fn buy_shot(ctx: Context<BuyShot>) -> Result<()> {
        if TREASURE_PUBKEY != *ctx.accounts.treasury.key {
            return Err(ShotErrorCode::InvalidTreasury.into());
        }

        // Add a new receipt to the receipts account.
        let receipt_id = ctx.accounts.receipts.total_shots_sold;
        ctx.accounts.receipts.receipts.push(Receipt {
            buyer: *ctx.accounts.signer.key,
            was_delivered: false,
            price: 1,
            timestamp: Clock::get()?.unix_timestamp,
            receipt_id,
        });

        let len = ctx.accounts.receipts.receipts.len();
        if len >= 10 {
            ctx.accounts.receipts.receipts.remove(0);
        }

        // Increment the total shots sold.
        ctx.accounts.receipts.total_shots_sold = ctx
            .accounts
            .receipts
            .total_shots_sold
            .checked_add(1)
            .unwrap();

        // Transfer lamports to the treasury for payment.
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.signer.to_account_info().clone(),
                to: ctx.accounts.treasury.to_account_info().clone(),
            },
        );
        system_program::transfer(cpi_context, SHOT_PRICE)?;

        Ok(())
    }

    pub fn mark_shot_as_delivered(ctx: Context<MarkShotAsDelivered>, recipe_id: u64) -> Result<()> {
        msg!("Marked shot as delivered");
        for i in 0..ctx.accounts.receipts.receipts.len() {
            msg!("Marked shot as delivered  {}", i);
            if ctx.accounts.receipts.receipts[i].receipt_id == recipe_id {
                msg!("Marked shot as delivered {} {} ", recipe_id, i);
                ctx.accounts.receipts.receipts[i].was_delivered = true;
            }
        }
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, space = 5000, seeds = [b"receipts"], bump)]
    pub receipts: Account<'info, Receipts>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct BuyShot<'info> {
    #[account(mut, seeds = [b"receipts"], bump)]
    pub receipts: Account<'info, Receipts>,
    #[account(mut)]
    pub signer: Signer<'info>,
    /// CHECK: checked against the treasury pubkey.
    #[account(mut)]
    pub treasury: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MarkShotAsDelivered<'info> {
    #[account(mut, seeds = [b"receipts"], bump)]
    pub receipts: Account<'info, Receipts>,
    #[account(mut)]
    pub signer: Signer<'info>,
}

#[account()]
pub struct Receipts {
    pub receipts: Vec<Receipt>,
    pub total_shots_sold: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct Receipt {
    pub receipt_id: u64,
    pub buyer: Pubkey,
    pub was_delivered: bool,
    pub price: u64,
    pub timestamp: i64,
}
