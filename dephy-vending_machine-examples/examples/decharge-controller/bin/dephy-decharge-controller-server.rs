use std::path::PathBuf;

use clap::value_parser;
use clap::Arg;
use clap::ArgAction;
use clap::ArgMatches;
use clap::Command;
use nostr::Keys;

const SESSION: &str = "dephy-decharge-controller";

fn parse_args() -> Command {
    Command::new("dephy-decharge-controller-server")
        .arg_required_else_help(true)
        .about("Dephy decharge controller server")
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
            Arg::new("KEY")
                .long("key")
                .num_args(1)
                .required(true)
                .action(ArgAction::Set)
                .help("Hex or bech32 secret key"),
        )
        .arg(
            Arg::new("PG_URL")
                .long("pg-url")
                .num_args(1)
                .required(true)
                .action(ArgAction::Set)
                .help("Will use this address to connect to postgres"),
        )
        .arg(
            Arg::new("SOLANA_RPC_URL")
                .long("solana-rpc-url")
                .num_args(1)
                .required(true)
                .action(ArgAction::Set)
                .help("Solana RPC URL"),
        )
        .arg(
            Arg::new("SOLANA_KEYPAIR")
                .long("solana-keypair")
                .num_args(1)
                .default_value("data/solana-keypair")
                .value_parser(value_parser!(PathBuf))
                .action(ArgAction::Set)
                .help("Solana keypair path"),
        )
}

async fn controller(args: &ArgMatches) {
    let nostr_relay = args.get_one::<String>("NOSTR_RELAY").unwrap();
    let keys: Keys = args
        .get_one::<String>("KEY")
        .unwrap()
        .parse()
        .expect("Invalid key");
    let pg_url = args.get_one::<String>("PG_URL").unwrap();
    let solana_rpc_url = args.get_one::<String>("SOLANA_RPC_URL").unwrap();
    let solana_keypair_path = args.get_one::<PathBuf>("SOLANA_KEYPAIR").unwrap();
    if !solana_keypair_path.exists() {
        panic!(
            "Solana keypair file not found: {}",
            solana_keypair_path.display()
        );
    }

    println!("nostr relay: {}", nostr_relay);
    println!("pubkey: {}", keys.public_key());

    let client = dephy_decharge_controller::RelayClient::new(nostr_relay, &keys, SESSION, 4096)
        .await
        .expect("Failed to connect to relay");

    let db = sqlx::PgPool::connect(pg_url)
        .await
        .expect("Failed to connect to database");
    let state = dephy_decharge_controller::server::State::new(db);

    let message_handler = dephy_decharge_controller::server::MessageHandler::new(
        client,
        state,
        solana_rpc_url,
        solana_keypair_path
            .to_str()
            .expect("Invalid solana keypair path"),
        None,
    );

    message_handler.run().await
}

#[tokio::main]
async fn main() {
    let _ = tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .try_init();

    let cmd = parse_args();
    controller(&cmd.get_matches()).await;
}
