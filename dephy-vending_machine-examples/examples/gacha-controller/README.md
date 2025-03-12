# dephy-gacha-controller

## Prepare

In this example, you should have a messaging network running on `ws://127.0.0.1:8000`.
You can modify `--nostr-relay` if it is running on a different address.

To run a messaging network you need a postgresql database with schema:

```sql
CREATE TABLE IF NOT EXISTS events (
    id bigserial PRIMARY KEY,
    event_id character varying NOT NULL,
    prev_event_id character varying NOT NULL,
    pubkey character varying NOT NULL,
    created_at bigint NOT NULL,
    original character varying NOT NULL,
    "session" character varying NOT NULL,
    mention character varying,

    CONSTRAINT events_unique_event_id
    UNIQUE (event_id),

    CONSTRAINT events_unique_pubkey_session_prev_event_id
    UNIQUE (pubkey, session, prev_event_id)
);
```

To run a messaging network by docker:

```shell
docker run --name dephy-messaging-network --restart=always --network="host" -d dephyio/dephy-messaging-network:master serve --pg-url 'postgresql://<username>:<password>@<address>/<db>'
```

## Run Controller (this is on gacha equipment side)

The controller daemon need your solana keypair.

```shell
mkdir data
# copy your keypair to data/solana-keypair
```

```shell
cargo run --bin dephy-gacha-controller -- --nostr-relay ws://127.0.0.1:8000 --machine-pubkeys 91550af28891a6ac6c73e0d415ed5ee9ea5603ef6d276df623a8b80254519ab2 --admin-pubkey <the pubkey of your private nostr key or use random one> --solana-rpc-url https://api.devnet.solana.com
```

## Cli Example (it simulates the process of inserting a coin)

```shell
cargo run --example cli -- --nostr-relay ws://127.0.0.1:8000 --machine-pubkey 91550af28891a6ac6c73e0d415ed5ee9ea5603ef6d276df623a8b80254519ab2 --user <user solana address> --nonce <nonce of recover info> --recover-info <recover info>
```
