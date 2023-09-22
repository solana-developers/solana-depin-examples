export type LorawanChest = {
  "version": "0.1.0",
  "name": "lorawan_chest",
  "instructions": [
    {
      "name": "initialize",
      "accounts": [
        {
          "name": "lorawanChest",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "authority",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "rent",
          "isMut": false,
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
      "name": "switch",
      "accounts": [
        {
          "name": "lorawanChest",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "authority",
          "isMut": true,
          "isSigner": true
        }
      ],
      "args": [
        {
          "name": "isOn",
          "type": "bool"
        }
      ]
    },
    {
      "name": "loot",
      "accounts": [
        {
          "name": "lorawanChest",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "authority",
          "isMut": true,
          "isSigner": true
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "lorawanChest",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "isOpen",
            "type": "bool"
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6100,
      "name": "ChestIsClosed"
    }
  ]
};

export const IDL: LorawanChest = {
  "version": "0.1.0",
  "name": "lorawan_chest",
  "instructions": [
    {
      "name": "initialize",
      "accounts": [
        {
          "name": "lorawanChest",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "authority",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "rent",
          "isMut": false,
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
      "name": "switch",
      "accounts": [
        {
          "name": "lorawanChest",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "authority",
          "isMut": true,
          "isSigner": true
        }
      ],
      "args": [
        {
          "name": "isOn",
          "type": "bool"
        }
      ]
    },
    {
      "name": "loot",
      "accounts": [
        {
          "name": "lorawanChest",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "authority",
          "isMut": true,
          "isSigner": true
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "lorawanChest",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "isOpen",
            "type": "bool"
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6100,
      "name": "ChestIsClosed"
    }
  ]
};
