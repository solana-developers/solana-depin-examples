import { Connection, PublicKey } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
import { IDL, SolanaBar } from "./solana_bar";

export const CONNECTION = new Connection(process.env.NEXT_PUBLIC_RPC ? process.env.NEXT_PUBLIC_RPC : 'https://api.devnet.solana.com',  {
    wsEndpoint: process.env.NEXT_PUBLIC_WSS_RPC ? process.env.NEXT_PUBLIC_WSS_RPC : "wss://api.devnet.solana.com",
    commitment: 'confirmed' 
  });

export const SOLANA_BAR_PROGRAM_ID = new PublicKey('GCgyx9JPNpqX97iWQh7rqPjaignahkS8DqQGdDdfXsPQ');

export const SOLANA_BAR_PROGRAM = new Program<SolanaBar>(IDL, SOLANA_BAR_PROGRAM_ID, { connection: CONNECTION })

export const RECEIPTS_PDA = PublicKey.findProgramAddressSync(
  [
    Buffer.from("receipts"),
  ],
  SOLANA_BAR_PROGRAM_ID,
)[0];