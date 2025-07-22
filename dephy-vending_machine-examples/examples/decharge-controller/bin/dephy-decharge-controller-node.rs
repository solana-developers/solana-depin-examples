use std::path::PathBuf;

use clap::value_parser;
use clap::Arg;
use clap::ArgAction;
use clap::ArgMatches;
use clap::Command;
use nostr::Keys;

const SESSION: &str = "dephy-decharge-controller";

fn parse_args() -> Command {
    Command::new("dephy-decharge-controller-node")
        .arg_required_else_help(true)
        .about("Dephy decharge controller node daemon")
        .version(dephy_decharge_controller::VERSION)
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
            Arg::new("ADMIN_PUBKEY")
                .long("admin-pubkey")
                .num_args(1)
                .required(true)
                .action(ArgAction::Set)
                .help("Admin public key"),
        )
        .arg(
            Arg::new("MACHINE_PUBKEYS")
                .long("machine-pubkeys")
                .num_args(1)
                .required(true)
                .action(ArgAction::Set)
                .help("Machine public keys, comma separated"),
        )
        .arg(
            Arg::new("SOLANA_RPC_URL")
                .long("solana-rpc-url")
                .num_args(1)
                .required(true)
                .action(ArgAction::Set)
                .help("Solana RPC URL"),
        )
}

async fn controller(args: &ArgMatches) {
    let nostr_relay = args.get_one::<String>("NOSTR_RELAY").unwrap();
    let key_file_path = args.get_one::<PathBuf>("KEY_FILE").unwrap();
    let keys = read_or_generate_keypair(key_file_path);
    let admin_pubkey = args
        .get_one::<String>("ADMIN_PUBKEY")
        .unwrap()
        .parse()
        .expect("Invalid admin pubkey");
    let machine_pubkeys = args
        .get_one::<String>("MACHINE_PUBKEYS")
        .unwrap()
        .split(',')
        .map(|s| s.parse().expect("Invalid machine pubkey"))
        .collect();
    let solana_rpc_url = args.get_one::<String>("SOLANA_RPC_URL").unwrap();

    println!("nostr relay: {}", nostr_relay);
    println!("pubkey: {}", keys.public_key());

    let client = dephy_decharge_controller::RelayClient::new(nostr_relay, &keys, SESSION, 4096)
        .await
        .expect("Failed to connect to relay");

    let message_handler = dephy_decharge_controller::node::MessageHandler::new(
        client,
        keys.public_key(),
        admin_pubkey,
        machine_pubkeys,
        solana_rpc_url,
    );

    message_handler.run().await
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
    controller(&cmd.get_matches()).await;
}
