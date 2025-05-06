#!/bin/bash

# this script fetches a blob from the Termina Data Module and verifies expected fields exist

PROGRAM_ID="2RWsr92iL39YCLiZu7dZ5hron4oexEMbgWDg35v5U5tH"
NAMESPACE="nitro"
SIGNATURES=("$@")  # Accept blob signatures as arguments

if [ ${#SIGNATURES[@]} -eq 0 ]; then
  echo "❌ Please provide blob signature(s)."
  exit 1
fi

# fetch the blob and decode from hex to plain JSON
blob_data=$(nitro-da-cli \
  --program-id "$PROGRAM_ID" \
  --namespace "$NAMESPACE" \
  -o json \
  blob fetch "${SIGNATURES[@]}" \
  | jq -r '.[].data' | xxd -r -p)

# print the full decoded blob (for visibility)
echo "---- Blob Content ----"
echo "$blob_data"
echo "----------------------"

errors=0

# check for required fields inside the blob
for field in "device_id" "reward" "co2_ppm" "merkle_root" "proof"; do
  if ! echo "$blob_data" | grep -q "\"$field\""; then
    echo "❌ Missing field: $field"
    errors=$((errors + 1))
  fi
done

# final result
if [ "$errors" -eq 0 ]; then
  echo "✅ Blob passed verification."
else
  echo "❌ Blob failed verification with $errors issue(s)."
fi