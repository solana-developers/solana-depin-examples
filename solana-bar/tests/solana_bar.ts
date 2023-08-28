export type SolanaBar = {
  "version": "0.1.0",
  "name": "solana_bar",
  "instructions": [
    {
      "name": "initialize",
      "accounts": [
        {
          "name": "receipts",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "authority",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "buyShot",
      "accounts": [
        {
          "name": "receipts",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "signer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "treasury",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "markShotAsDelivered",
      "accounts": [
        {
          "name": "receipts",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "signer",
          "isMut": true,
          "isSigner": true
        }
      ],
      "args": [
        {
          "name": "recipeId",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "receipts",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "receipts",
            "type": {
              "vec": {
                "defined": "Receipt"
              }
            }
          },
          {
            "name": "totalShotsSold",
            "type": "u64"
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "Receipt",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "receiptId",
            "type": "u64"
          },
          {
            "name": "buyer",
            "type": "publicKey"
          },
          {
            "name": "wasDelivered",
            "type": "bool"
          },
          {
            "name": "price",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "InvalidTreasury",
      "msg": "InvalidTreasury"
    }
  ]
};

export const IDL: SolanaBar = {
  "version": "0.1.0",
  "name": "solana_bar",
  "instructions": [
    {
      "name": "initialize",
      "accounts": [
        {
          "name": "receipts",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "authority",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "buyShot",
      "accounts": [
        {
          "name": "receipts",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "signer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "treasury",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "markShotAsDelivered",
      "accounts": [
        {
          "name": "receipts",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "signer",
          "isMut": true,
          "isSigner": true
        }
      ],
      "args": [
        {
          "name": "recipeId",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "receipts",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "receipts",
            "type": {
              "vec": {
                "defined": "Receipt"
              }
            }
          },
          {
            "name": "totalShotsSold",
            "type": "u64"
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "Receipt",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "receiptId",
            "type": "u64"
          },
          {
            "name": "buyer",
            "type": "publicKey"
          },
          {
            "name": "wasDelivered",
            "type": "bool"
          },
          {
            "name": "price",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "InvalidTreasury",
      "msg": "InvalidTreasury"
    }
  ]
};
