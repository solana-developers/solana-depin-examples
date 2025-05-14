# Termina Data Anchor Demo (CLI)

Termina’s Data Anchor lets teams anchor structured data blobs directly on Solana without custom programs required.
It’s especially useful for DePIN networks publishing verifiable device data like sensor readings or reward snapshots, in a cost-effective and high-throughput way.

This example uses the CLI to walk through the full flow: upload a JSON reward file, fetch it from chain, and verify its contents locally.
For production use, we recommend the Rust SDK for tighter integration.

---

## What this demo shows

This demo simulates a DePIN reward batch upload.

- Two sensors report their data: IPs, CO₂ levels, data points submitted, and reward amounts
- A Merkle root summarizes the batch, and a placeholder zk proof is attached
- The file is uploaded as a blob via the CLI
- The blob is fetched from Solana and decoded
- A script verifies its structure

> Think of this as a simplified version of how large DePIN networks might anchor thousands of device reports at once.

---

## Folder contents

- `rewards.json` – Mock data file containing a reward batch from 2 devices  
- `upload_blob.sh` – Uploads the JSON to Solana using the Termina CLI  
- `verify_blob.sh` – Fetches and verifies the blob fields

---

## Prerequisites

To run this demo, you just need:

- A terminal (macOS, Linux, or WSL on Windows)
- `jq` and `xxd` installed (used to parse and decode the blob output)

---

## 1. Prepare your data

The file `rewards.json` simulates a real batch upload:

```json
{
  "epoch": 1042,
  "location": "Zug, Switzerland",
  "devices": [
    {
      "device_id": "sensor-001",
      "ip": "192.168.0.101",
      "data_points": 340,
      "co2_ppm": 417,
      "reward": "0.03"
    },
    {
      "device_id": "sensor-002",
      "ip": "192.168.0.102",
      "data_points": 327,
      "co2_ppm": 419,
      "reward": "0.02"
    }
  ],
  "total_reward": "0.05",
  "merkle_root": "abc123xyz456",
  "proof": "mock_zk_proof_here"
}
````

---

## 2. Upload the blob

Run the following to upload the file to Solana via the Data Anchor:

```bash
./upload_blob.sh
```

You’ll receive one or more blob signatures in response, depending on the file size. These signatures are needed to fetch the blob.

---

## 3. Fetch and decode the blob

Use the CLI and signatures to retrieve the blob:

```bash
nitro-da-cli \
  --program-id "2RWsr92iL39YCLiZu7dZ5hron4oexEMbgWDg35v5U5tH" \
  --namespace "nitro" \
  -o json \
  blob fetch <sig1> <sig2> ... \
  | jq -r '.[].data' | xxd -r -p
```

Replace `<sig1> <sig2> ...` with the signatures you received earlier.

This will return the original JSON content.

---

## 4. Verify the blob contents

To simulate how a verifier or client might validate the blob, run:

```bash
./verify_blob.sh <sig1> <sig2> ...
```

This script checks that the blob includes:

* `device_id`
* `reward`
* `co2_ppm`
* `merkle_root`
* `proof`

> This is an example verification logic. Actual validation requirements may vary based on the domain and use case.

---

## Link to official documentation

This demo follows the steps from:
📖 [Using the Data Anchor](https://docs.termina.technology/documentation/network-extension-stack/ne-modules/data-anchor/using-the-data-anchor)

It covers:

* Blob upload
* Retrieval and decoding
* Basic verification workflow

---

## Crate Links (CLI and Module Components)

The source code for the CLI and related components is published on [crates.io](https://crates.io), and visible to anyone who installs them:

- [nitro-da-cli](https://crates.io/crates/nitro-da-cli)  
- [nitro-da-client](https://crates.io/crates/nitro-da-client)  
- [nitro-da-blober](https://crates.io/crates/nitro-da-blober)  
- [nitro-da-indexer-api](https://crates.io/crates/nitro-da-indexer-api)  
- [nitro-da-proofs](https://crates.io/crates/nitro-da-proofs)

---

## License

MIT
