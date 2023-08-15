use anchor_lang::prelude::*;

declare_id!("F7F5ZTEMU6d5Ac8CQEJKBGWXLbte1jK2Kodyu3tNtvaj");

#[program]
pub mod led_switch {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        ctx.accounts.led_switch.is_on = false;
        Ok(())
    }

    pub fn switch(ctx: Context<Switch>, is_on: bool) -> Result<()> {
        ctx.accounts.led_switch.is_on = is_on;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, space = 8 + 8, seeds = [b"led-switch"], bump)]
    pub led_switch: Account<'info, LedSwitch>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Switch<'info> {
    #[account(mut, seeds = [b"led-switch"], bump)]
    pub led_switch: Account<'info, LedSwitch>,
    #[account(mut)]
    pub authority: Signer<'info>,
}

#[account]
pub struct LedSwitch {
    pub is_on: bool,
}
