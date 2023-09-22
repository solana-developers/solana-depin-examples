import { Connection, PublicKey } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
import { IDL, LorawanChest } from "./lorawan_chest";

export const CONNECTION = new Connection(process.env.NEXT_PUBLIC_RPC ? process.env.NEXT_PUBLIC_RPC : 'https://api.devnet.solana.com',  {
    wsEndpoint: process.env.NEXT_PUBLIC_WSS_RPC ? process.env.NEXT_PUBLIC_WSS_RPC : "wss://api.devnet.solana.com",
    commitment: 'confirmed' 
  });

export const LORAWAN_CHEST_PROGRAM_ID = new PublicKey('2UYaB7aU7ZPA5LEQh3ZtWzC1MqgLkEJ3nBKebGUrFU3f');

export const LORAWAN_CHEST_PROGRAM = new Program<LorawanChest>(IDL, LORAWAN_CHEST_PROGRAM_ID, { connection: CONNECTION })

export const LORAWAN_CHEST_PDA = PublicKey.findProgramAddressSync(
  [
    Buffer.from("lorawan_chest"),
  ],
  LORAWAN_CHEST_PROGRAM_ID,
)[0];