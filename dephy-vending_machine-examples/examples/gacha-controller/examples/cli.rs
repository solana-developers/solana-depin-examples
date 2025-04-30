use std::path::PathBuf;

use clap::value_parser;
use clap::Arg;
use clap::ArgAction;
use clap::ArgMatches;
use clap::Command;
use dephy_gacha_controller::message::DephyGachaMessage;
use dephy_gacha_controller::message::DephyGachaMessageRequestPayload;
use dephy_gacha_controller::message::DephyGachaStatus;
use dephy_gacha_controller::message::DephyGachaStatusReason;
use nostr::Keys;
use nostr::Timestamp;
use nostr_sdk::EventId;

const SESSION: &str = "dephy-gacha-controller";

fn parse_args() -> Command {
    Command::new("dephy-gacha-controller-cli")
        .arg_required_else_help(true)
        .about("Dephy gacha controller")
        .version(dephy_gacha_controller::VERSION)
        .arg(
            Arg::new("NOSTR_RELAY")
                .long("nostr-relay")
                .num_args(1)
                .required(true)
                .action(ArgAction::Set)
                .help("Nostr relay address"),
        )
        .arg(
            Arg::new("KEY_FILE")
                .long("key-file")
                .num_args(1)
                .default_value("data/key")
                .value_parser(value_parser!(PathBuf))
                .action(ArgAction::Set)
                .help("Path to the file containing the hex or bech32 secret key"),
        )
        .arg(
            Arg::new("MACHINE_PUBKEY")
                .long("machine-pubkey")
                .num_args(1)
                .required(true)
                .action(ArgAction::Set)
                .help("Machine public keys, comma separated"),
        )
        .arg(
            Arg::new("user")
                .long("user")
                .num_args(1)
                .required(true)
                .action(ArgAction::Set)
                .help("User public key"),
        )
        .arg(
            Arg::new("nonce")
                .long("nonce")
                .num_args(1)
                .required(true)
                .value_parser(value_parser!(u64))
                .action(ArgAction::Set)
                .help("Nonce"),
        )
        .arg(
            Arg::new("recover_info")
                .long("recover-info")
                .num_args(1)
                .required(true)
                .action(ArgAction::Set)
                .help("Recover info"),
        )
}

async fn cli(args: &ArgMatches) {
    let nostr_relay = args.get_one::<String>("NOSTR_RELAY").unwrap();
    let key_file_path = args.get_one::<PathBuf>("KEY_FILE").unwrap();
    let keys = read_or_generate_keypair(key_file_path);
    let machine_pubkey = args
        .get_one::<String>("MACHINE_PUBKEY")
        .unwrap()
        .parse()
        .expect("Invalid machine pubkey");
    let user = args.get_one::<String>("user").unwrap();
    let nonce = args.get_one::<u64>("nonce").unwrap();
    let recover_info = args.get_one::<String>("recover_info").unwrap();

    let client = dephy_gacha_controller::RelayClient::new(nostr_relay, &keys, SESSION, 4096)
        .await
        .expect("Failed to connect to relay");

    let mut notifications = client.notifications();
    client
        .subscribe(Timestamp::now(), [machine_pubkey])
        .await
        .expect("Failed to subscribe");

    let handler = tokio::spawn(async move {
        loop {
            let notification = notifications.recv().await;
            tracing::info!("Received notification: {:?}", notification);
        }
    });

    let payload = serde_json::to_string(&DephyGachaMessageRequestPayload {
        user: user.clone(),
        nonce: *nonce,
        recover_info: recover_info.clone(),
    })
    .expect("Failed to serialize payload");

    client
        .send_event(&machine_pubkey.to_hex(), &DephyGachaMessage::Request {
            to_status: DephyGachaStatus::Working,
            reason: DephyGachaStatusReason::UserRequest,
            initial_request: EventId::all_zeros(),
            payload,
        })
        .await
        .expect("Failed to send event");

    handler.await.expect("Notification handler failed");
}

fn read_or_generate_keypair(path: &PathBuf) -> Keys {
    let keys = std::fs::read_to_string(path)
        .map(|content| content.trim().parse().expect("Invalid key"))
        .unwrap_or_else(|_| {
            tracing::info!(
                "Key file not found, generating a new one at: {}",
                path.display()
            );
            let keys = Keys::generate();
            std::fs::write(path, keys.secret_key().to_secret_hex())
                .unwrap_or_else(|e| panic!("Failed to write key {}: {e:?}", path.display()));
            keys
        });

    let pubkey_path = path.with_extension("pub");
    std::fs::write(&pubkey_path, keys.public_key().to_hex()).unwrap_or_else(|e| {
        panic!(
            "Failed to write public key {}: {e:?}",
            pubkey_path.display()
        )
    });

    keys
}

#[tokio::main]
async fn main() {
    let _ = tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .try_init();

    let cmd = parse_args();
    cli(&cmd.get_matches()).await;
}
