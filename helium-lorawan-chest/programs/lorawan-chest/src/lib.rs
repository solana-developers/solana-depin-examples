use anchor_lang::prelude::*;
use solana_program::pubkey;

declare_id!("2UYaB7aU7ZPA5LEQh3ZtWzC1MqgLkEJ3nBKebGUrFU3f");

// Change this to what ever key you use in your API to make sure not everyone can just call the switch function.
const ADMIN_PUBKEY: Pubkey = pubkey!("LorBisZjmXHAdUnAWKfBiVh84yaxGVF2WY6kjr7AQu5");

#[error_code]
pub enum LorawanChestError {
    ChestIsClosed = 100,
}

#[program]
pub mod lorawan_chest {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        ctx.accounts.lorawan_chest.is_open = false;
        Ok(())
    }

    pub fn switch(ctx: Context<Switch>, is_on: bool) -> Result<()> {
        // Add some check here that actually only your api which is triggered be the sensor is allowed to call this.
        ctx.accounts.lorawan_chest.is_open = is_on;
        Ok(())
    }

    pub fn loot(ctx: Context<Switch>) -> Result<()> {
        if !ctx.accounts.lorawan_chest.is_open {
            return Err(LorawanChestError::ChestIsClosed.into());
        }

        // You can add any kind of loot action here.
        // In the next js api we add a transfer, but you could also mint an NFT for example.
        // Or you could save per user here which chests he already collected and build some real live adventure game.
        msg!("Looted!");

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, space = 8 + 8, seeds = [b"lorawan_chest"], bump)]
    pub lorawan_chest: Account<'info, LorawanChest>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Switch<'info> {
    #[account(mut, seeds = [b"lorawan_chest"], bump)]
    pub lorawan_chest: Account<'info, LorawanChest>,
    #[account(mut, address = ADMIN_PUBKEY)]
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct Loot<'info> {
    #[account(mut, seeds = [b"lorawan_chest"], bump)]
    pub lorawan_chest: Account<'info, LorawanChest>,
    #[account(mut)]
    pub authority: Signer<'info>,
}

#[account]
pub struct LorawanChest {
    pub is_open: bool,
}
