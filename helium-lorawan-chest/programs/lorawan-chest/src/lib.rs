use anchor_lang::prelude::*;

declare_id!("2UYaB7aU7ZPA5LEQh3ZtWzC1MqgLkEJ3nBKebGUrFU3f");

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
        ctx.accounts.lorawan_chest.is_open = is_on;
        Ok(())
    }

    pub fn loot(ctx: Context<Switch>) -> Result<()> {
        if !ctx.accounts.lorawan_chest.is_open {
            return Err(LorawanChestError::ChestIsClosed.into());
        }

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
    #[account(mut)]
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
