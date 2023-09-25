// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next';
import { Keypair, PublicKey, SYSVAR_RENT_PUBKEY, SystemProgram, Transaction } from '@solana/web3.js';
import { CONNECTION, LORAWAN_CHEST_PDA, LORAWAN_CHEST_PROGRAM } from '@/src/util/const';
var web3 = require("@solana/web3.js");

type POST = {
  transaction: string;
  message: string;
};

type GET = {
  label: string;
  icon: string;
};

function getFromPayload(req: NextApiRequest, payload: string, field: string): string {
  function parseError() { throw new Error(`${payload} parse error: missing ${field}`) };
  let value;
  if (payload === 'Query') {
    if (!(field in req.query)) parseError();
    value = req.query[field];
  }
  if (payload === 'Body') {
    if (!req.body || !(field in req.body)) parseError();
    value = req.body[field];
  }
  if (value === undefined || value.length === 0) parseError();
  return typeof value === 'string' ? value : value[0];
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return get(req, res);
  }

  if (req.method === 'POST') {
    return post(req, res);
  }
}

const get = async (req: NextApiRequest, res: NextApiResponse<GET>) => {
  const label = 'Lorawan Chest';
  const icon =
    'https://media.discordapp.net/attachments/964525722301501477/978683590743302184/sol-logo1.png';

  res.status(200).json({
    label,
    icon,
  });
};

const post = async (req: NextApiRequest, res: NextApiResponse<POST>) => {

  const accountField = getFromPayload(req, 'Body', 'account');
  const instructionField = getFromPayload(req, 'Query', 'instruction');

  const burner = JSON.parse(process.env.BURNER_KEY ?? "") as number[]
  const burnerKeypair = Keypair.fromSecretKey(Uint8Array.from(burner))  

  const sender = new PublicKey(accountField);

  const transaction = new Transaction();
  const latestBlockhash = await CONNECTION.getLatestBlockhash();
  transaction.feePayer = sender;
  transaction.recentBlockhash = latestBlockhash.blockhash;

  let message;
  console.log("Instruction:", instructionField);
  if (instructionField == "loot") {
    console.log("inside:", instructionField);

    let tokenTransferIx = web3.SystemProgram.transfer({
      fromPubkey: burnerKeypair.publicKey,
      toPubkey: sender,
      lamports: web3.LAMPORTS_PER_SOL / 10,
    })

    transaction.add(tokenTransferIx);

    let lootInstruction = await LORAWAN_CHEST_PROGRAM.methods.loot().accounts(
      {
        lorawanChest: LORAWAN_CHEST_PDA,
        authority: sender,
      },
    ).instruction();

    transaction.add(lootInstruction);

    transaction.sign(burnerKeypair);

    message = 'Loot chest!';
  } else if (instructionField == "initialize") {
    let ix = await LORAWAN_CHEST_PROGRAM.methods.initialize().accounts(
      {
        lorawanChest: LORAWAN_CHEST_PDA,
        authority: sender,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      },
    ).instruction();
    
    transaction.add(ix);
    
    message = 'Initialize PDA !';
  } else {
    message = 'Unknown instruction';
  }
 
  console.log("message:", message);

  // Serialize and return the unsigned transaction.
  const serializedTransaction = transaction.serialize({
    verifySignatures: false,
    requireAllSignatures: false,
  });

  const base64Transaction = serializedTransaction.toString('base64');

  res.status(200).send({ transaction: base64Transaction, message });
};
