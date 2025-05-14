#!/bin/bash

# upload rewards.json using Termina's Data Anchor CLI
# program ID below is the mainnet deployment of the Data Anchor
# Mainnet Program ID: 9i2MEc7s38jLGoEkbFszuTJCL1w3Uorg7qjPjfN8Tv5Z
# namespace used in this demo: "nitro"

nitro-da-cli \
  --program-id "9i2MEc7s38jLGoEkbFszuTJCL1w3Uorg7qjPjfN8Tv5Z" \
  --namespace "nitro" \
  blob upload --data-path "./rewards.json"
