use crate::{
    constants::{self, DISCRIMINATOR_SIZE},
    errors::CustomError,
    state::{GlobalAccount, LockAccount, UserAccount},
    utils,
};
use anchor_lang::{prelude::*, solana_program::keccak};
use bs58;

pub fn lock(ctx: Context<Lock>, recover_info: ED25519RecoverInfo, amount: u64) -> Result<()> {
    let user_account = &mut ctx.accounts.user_account;
    let lock_account = &mut ctx.accounts.lock_account;

    recover_info.verify(user_account.nonce, &ctx.accounts.user.key())?;

    require!(
        ctx.accounts.vault.get_lamports() - user_account.locked_amount >= amount,
        CustomError::InsufficientFunds
    );

    user_account.nonce += 1;
    user_account.locked_amount += amount;

    lock_account.amount = amount;

    Ok(())
}

#[derive(Accounts)]
pub struct Lock<'info> {
    #[account(has_one = bot @ CustomError::Unauthorized, seeds = [b"GLOBAL"], bump)]
    pub global_account: Account<'info, GlobalAccount>,
    #[account(mut, seeds = [b"USER", user.key.as_ref()], bump)]
    pub user_account: Account<'info, UserAccount>,
    /// CHECK:
    #[account(mut)]
    pub user: UncheckedAccount<'info>,
    #[account(
        init,
        payer = payer,
        space = DISCRIMINATOR_SIZE + LockAccount::INIT_SPACE,
        seeds = [b"LOCK", user.key().as_ref(), user_account.nonce.to_le_bytes().as_ref()],
        bump,
    )]
    pub lock_account: Account<'info, LockAccount>,
    /// CHECK:
    #[account(seeds = [b"VAULT", user.key().as_ref()], bump)]
    pub vault: UncheckedAccount<'info>,
    pub bot: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize)]
pub struct ED25519RecoverInfo {
    pub signature: [u8; 64],
    pub payload: [u8; 64],
    pub deadline: i64,
}

impl ED25519RecoverInfo {
    pub fn verify(&self, nonce: u64, pubkey: &Pubkey) -> Result<()> {
        let message = {
            let mut data = self.payload.to_vec();
            data.extend_from_slice(&nonce.to_le_bytes());
            data.extend_from_slice(&self.deadline.to_le_bytes());
            data
        };

        let hashed_message = {
            let mut hasher = keccak::Hasher::default();
            hasher.hash(&message);
            hasher.result().to_bytes()
        };

        let hashed_message_base58 = bs58::encode(&hashed_message).into_vec();

        let digest = {
            let mut data = constants::SIGN_MESSAGE_PREFIX.to_vec(); // 前缀转换为 Vec<u8>
            data.extend_from_slice(&hashed_message_base58); // 添加 Base58 编码的哈希值
            data
        };

        let valid = utils::verify_signature(pubkey, &self.signature, &digest)
            .map_err(|_| CustomError::SignatureFormatInvalid)?;

        require!(valid, CustomError::SignatureMismatch);

        let clock = Clock::get()?;
        require!(
            clock.unix_timestamp <= self.deadline,
            CustomError::SignatureExpired
        );

        Ok(())
    }
}
