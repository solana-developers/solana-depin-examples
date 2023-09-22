// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next';
import { Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { CONNECTION, LORAWAN_CHEST_PDA, LORAWAN_CHEST_PROGRAM } from '@/src/util/const';

type POST = {
  message: string;
};

type GET = {
  label: string;
  icon: string;
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return get(req, res);
  }

  if (req.method === 'POST') {
    return post(req, res);
  }
}

const get = async (req: NextApiRequest, res: NextApiResponse<GET>) => {
  const label = 'LED Switch';
  const icon =
    'https://media.discordapp.net/attachments/964525722301501477/978683590743302184/sol-logo1.png';

    console.log("Sensor response:", req.body);
    console.log("Door is open:", req.body.decoded.payload.DOOR_OPEN_STATUS);
  
    var message = '';
    if (req.body.decoded.payload.DOOR_OPEN_STATUS == "0") {
      message = 'Door open !';
    } else {
      message = 'Door Closed';
    }

  res.status(200).json({
    label,
    icon,
  });
};

const post = async (req: NextApiRequest, res: NextApiResponse<POST>) => {

  console.log("Door is open:", req.body);
  console.log("Door is open:", req.body.decoded.payload.DOOR_OPEN_STATUS);

  const burner = JSON.parse(process.env.BURNER_KEY ?? "") as number[]
  const burnerKeypair = Keypair.fromSecretKey(Uint8Array.from(burner))  
  const sender = burnerKeypair.publicKey;

  const transaction = new Transaction();
  const latestBlockhash = await CONNECTION.getLatestBlockhash();
  transaction.feePayer = sender;
  transaction.recentBlockhash = latestBlockhash.blockhash;

  let message = '';

  if (req.body.decoded.payload.DOOR_OPEN_STATUS == "1") {
    let ix = await LORAWAN_CHEST_PROGRAM.methods.switch(true).accounts(
      {
      lorawanChest: LORAWAN_CHEST_PDA,
      authority: sender
      },
    ).instruction();
    
    transaction.add(ix);
    
    message = 'Door open !';
  } else {
    let ix = await LORAWAN_CHEST_PROGRAM.methods.switch(false).accounts(
      {
      lorawanChest: LORAWAN_CHEST_PDA,
      authority: sender
      },
    ).instruction();
    
    transaction.add(ix);
    message = 'Door Closed';
  }

  var signature = await CONNECTION.sendTransaction(transaction, [burnerKeypair]);
  console.log("Transaction signature:", signature);

  res.status(200).send({ message });
};
