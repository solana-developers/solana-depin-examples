# syntax=docker/dockerfile:1
# see all versions at https://hub.docker.com/r/oven/bun/tags
FROM oven/bun:1

WORKDIR /opt/balance-payment-bot
COPY . .
RUN bun install --frozen-lockfile

# ENV SOLANA_NETWORK="devnet"
# ENV SOLANA_RPC="https://api.devnet.solana.com"

VOLUME ["/opt/solana"]

ENTRYPOINT ["bun", "run", "index.ts"]
