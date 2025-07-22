Bot example
====

## Prepare

`bun i`

## Sign Message

```
bun run index.ts sign_message --net devnet --rpc "https://api.devnet.solana.com" --keypair "./user.demo.json" --minutes 30
```

## Check Eligible

```
bun run index.ts check_eligible --net devnet --rpc "https://api.devnet.solana.com" --user "user Solana address" --amount "0.01" --nonce "nonce from request payload" --recoverInfo "User request content(Base64)"
```

## Lock

```
bun run index.ts lock --net devnet --rpc "https://api.devnet.solana.com" --keypair "./bot.demo.json" --user "user Solana address" --amount "0.01" --recoverInfo "User request content(Base64)"
```

## Settle

```
bun run index.ts settle --net devnet --rpc "https://api.devnet.solana.com" --keypair "./bot.demo.json" --user "user Solana address" --nonce "nonce related lock" --amountToTransfer "0.005"
```

## Build Docker image

```
docker build --platform linux/amd64,linux/arm64 -t balance-payment-bot .
```
