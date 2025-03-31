#[allow(clippy::all)]
#[allow(warnings, unused)]
#[rustfmt::skip]
mod generated;

mod error;
mod verify;

use std::time::Duration;
use std::time::SystemTime;
use std::time::UNIX_EPOCH;

pub use error::Error;
use generated::accounts::GlobalAccount;
use generated::accounts::UserAccount;
use generated::instructions::Lock;
use generated::instructions::LockInstructionArgs;
use generated::instructions::Pay;
use generated::instructions::PayInstructionArgs;
use generated::instructions::Settle;
use generated::instructions::SettleInstructionArgs;
use generated::programs::BALANCE_PAYMENT_ID;
use generated::types::ED25519RecoverInfo;
use solana_client::nonblocking::rpc_client::RpcClient;
use solana_program::pubkey::Pubkey;
use solana_sdk::bs58;
use solana_sdk::commitment_config::CommitmentConfig;
use solana_sdk::keccak;
use solana_sdk::signature::Keypair;
use solana_sdk::signer::EncodableKey;
use solana_sdk::signer::Signer;
use solana_sdk::system_program;
use solana_sdk::transaction::Transaction;
use verify::verify_signature;

const SIGN_MESSAGE_PREFIX: &[u8; 31] = b"DePHY vending machine/Example:\n";

fn get_client(url: &str) -> RpcClient {
    let timeout = Duration::from_secs(10);
    let commitment_config = CommitmentConfig::processed();
    let confirm_transaction_initial_timeout = Duration::from_secs(10);
    RpcClient::new_with_timeouts_and_commitment(
        url.to_string(),
        timeout,
        commitment_config,
        confirm_transaction_initial_timeout,
    )
}

pub async fn check_eligible(
    rpc_url: &str,
    user: &str,
    nonce: u64,
    amount: u64,
    recover_info: &str,
) -> Result<bool, Error> {
    let user: Pubkey = user.parse()?;
    let recover_info: ED25519RecoverInfo = serde_json::from_str(recover_info)?;

    let client = get_client(rpc_url);

    let user_account_pubkey =
        Pubkey::find_program_address(&[b"USER", user.as_ref()], &BALANCE_PAYMENT_ID).0;
    let user_account_data = client.get_account_data(&user_account_pubkey).await?;
    let user_account = UserAccount::from_bytes(&user_account_data)?;

    // 0. check nonce
    if user_account.nonce != nonce {
        tracing::error!(
            "Nonce mismatch: expected {}, got {}",
            nonce,
            user_account.nonce
        );
        return Ok(false);
    }

    // 1. concat message
    let message = {
        let mut data = recover_info.payload.to_vec();
        data.extend_from_slice(&user_account.nonce.to_le_bytes());
        data.extend_from_slice(&recover_info.deadline.to_le_bytes());
        data
    };

    // 2. calc message hash
    let message_hash = {
        let mut hasher = keccak::Hasher::default();
        hasher.hash(&message);
        hasher.result().to_bytes()
    };

    // 3. generate digest
    let digest = {
        let mut data = SIGN_MESSAGE_PREFIX.to_vec();
        data.extend_from_slice(bs58::encode(&message_hash).into_string().as_bytes());
        data
    };

    // 4. verify signature
    let valid = verify_signature(&user, &recover_info.signature, &digest)
        .map_err(|e| {
            tracing::error!("Signature verification failed: {:?}", e);
            e
        })
        .is_ok();

    if !valid {
        tracing::error!("Invalid signature");
        return Ok(false);
    }

    // 5. check signature expiration
    let current_timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    if current_timestamp >= recover_info.deadline {
        tracing::error!("Signature expired: deadline {}", recover_info.deadline);
        return Ok(false);
    }

    // 6. check user vault balance
    let vault_pubkey =
        Pubkey::find_program_address(&[b"VAULT", user.as_ref()], &BALANCE_PAYMENT_ID).0;
    let vault_balance = client.get_account(&vault_pubkey).await?.lamports;

    if vault_balance - user_account.locked_amount < amount {
        tracing::error!(
            "Insufficient funds: available {}, required {}",
            vault_balance - user_account.locked_amount,
            amount
        );
        return Ok(false);
    }

    tracing::info!("User is eligible");
    Ok(true)
}

pub async fn lock(
    rpc_url: &str,
    keypair_path: &str,
    user: &str,
    amount: u64,
    recover_info: &str,
) -> Result<String, Error> {
    let user: Pubkey = user.parse()?;
    let recover_info: ED25519RecoverInfo = serde_json::from_str(recover_info)?;

    let bot = Keypair::read_from_file(keypair_path).map_err(Error::KeypairReadFailed)?;
    let payer = bot.insecure_clone();

    let client = get_client(rpc_url);

    let user_account_pubkey =
        Pubkey::find_program_address(&[b"USER", user.as_ref()], &BALANCE_PAYMENT_ID).0;
    let user_account_data = client.get_account_data(&user_account_pubkey).await?;
    let user_account = UserAccount::from_bytes(&user_account_data)?;

    let lock_instruction = Lock {
        global_account: Pubkey::find_program_address(&[b"GLOBAL"], &BALANCE_PAYMENT_ID).0,
        user_account: user_account_pubkey,
        user,
        lock_account: Pubkey::find_program_address(
            &[b"LOCK", user.as_ref(), &user_account.nonce.to_le_bytes()],
            &BALANCE_PAYMENT_ID,
        )
        .0,
        vault: Pubkey::find_program_address(&[b"VAULT", user.as_ref()], &BALANCE_PAYMENT_ID).0,
        bot: bot.pubkey(),
        payer: payer.pubkey(),
        system_program: system_program::id(),
    };

    let latest_block = client.get_latest_blockhash().await?;

    let transaction = Transaction::new_signed_with_payer(
        &[lock_instruction.instruction(LockInstructionArgs {
            amount,
            recover_info,
        })],
        Some(&payer.pubkey()),
        &[&bot, &payer],
        latest_block,
    );

    let signature = client.send_and_confirm_transaction(&transaction).await?;

    Ok(signature.to_string())
}

pub async fn settle(
    rpc_url: &str,
    keypair_path: &str,
    user: &str,
    nonce: u64,
    amount_to_transfer: u64,
) -> Result<String, Error> {
    let user: Pubkey = user.parse()?;

    let bot = Keypair::read_from_file(keypair_path).map_err(Error::KeypairReadFailed)?;
    let payer = bot.insecure_clone();

    let client = get_client(rpc_url);

    let global_account_pubkey = Pubkey::find_program_address(&[b"GLOBAL"], &BALANCE_PAYMENT_ID).0;
    let global_account_data = client.get_account_data(&global_account_pubkey).await?;
    let global_account: GlobalAccount = GlobalAccount::from_bytes(&global_account_data)?;
    let treasury = global_account.treasury;

    let latest_block = client.get_latest_blockhash().await?;

    let settle_instruction = Settle {
        global_account: global_account_pubkey,
        user_account: Pubkey::find_program_address(&[b"USER", user.as_ref()], &BALANCE_PAYMENT_ID)
            .0,
        user,
        treasury,
        lock_account: Pubkey::find_program_address(
            &[b"LOCK", user.as_ref(), &nonce.to_le_bytes()],
            &BALANCE_PAYMENT_ID,
        )
        .0,
        vault: Pubkey::find_program_address(&[b"VAULT", user.as_ref()], &BALANCE_PAYMENT_ID).0,
        bot: bot.pubkey(),
        payer: payer.pubkey(),
        system_program: system_program::id(),
    };

    let transaction = Transaction::new_signed_with_payer(
        &[settle_instruction.instruction(SettleInstructionArgs {
            nonce,
            amount_to_transfer,
        })],
        Some(&payer.pubkey()),
        &[&bot, &payer],
        latest_block,
    );

    let signature = client.send_and_confirm_transaction(&transaction).await?;

    Ok(signature.to_string())
}

pub async fn pay(
    rpc_url: &str,
    keypair_path: &str,
    user: &str,
    amount_to_transfer: u64,
    recover_info: &str,
) -> Result<String, Error> {
    let user: Pubkey = user.parse()?;
    let recover_info: ED25519RecoverInfo = serde_json::from_str(recover_info)?;

    let bot = Keypair::read_from_file(keypair_path).map_err(Error::KeypairReadFailed)?;
    let payer = bot.insecure_clone();

    let client = get_client(rpc_url);

    let global_account_pubkey = Pubkey::find_program_address(&[b"GLOBAL"], &BALANCE_PAYMENT_ID).0;
    let global_account_data = client.get_account_data(&global_account_pubkey).await?;
    let global_account: GlobalAccount = GlobalAccount::from_bytes(&global_account_data)?;
    let treasury = global_account.treasury;

    let latest_block = client.get_latest_blockhash().await?;

    let pay_instruction = Pay {
        global_account: global_account_pubkey,
        user_account: Pubkey::find_program_address(&[b"USER", user.as_ref()], &BALANCE_PAYMENT_ID)
            .0,
        user,
        treasury,
        vault: Pubkey::find_program_address(&[b"VAULT", user.as_ref()], &BALANCE_PAYMENT_ID).0,
        bot: bot.pubkey(),
        payer: payer.pubkey(),
        system_program: system_program::id(),
    };

    let transaction = Transaction::new_signed_with_payer(
        &[pay_instruction.instruction(PayInstructionArgs {
            amount_to_transfer,
            recover_info,
        })],
        Some(&payer.pubkey()),
        &[&bot, &payer],
        latest_block,
    );

    let signature = client.send_and_confirm_transaction(&transaction).await?;

    Ok(signature.to_string())
}
