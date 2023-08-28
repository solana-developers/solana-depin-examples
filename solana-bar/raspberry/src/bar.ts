import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { IDL, SolanaBar } from "./solana_bar";
import { clusterApiUrl, Connection, Keypair, PublicKey } from "@solana/web3.js";

var Gpio = require('onoff').Gpio; //include onoff to interact with the GPIO
var GPIO_23 = new Gpio(23, 'out'); //use GPIO pin 18, and specify that it is output

let connection = new Connection(clusterApiUrl("devnet"));

// Replace this with your own keypair to be able to pay for fees
const keypair = Keypair.fromSecretKey(
  Uint8Array.from([209,70,174,212,192,159,166,82,163,162,135,190,244,227,218,97,214,155,228,142,172,188,170,246,130,68,106,45,170,125,175,57,12,253,44,189,234,23,239,220,85,57,231,86,130,27,99,62,106,215,172,104,152,104,145,138,198,105,218,20,232,251,238,250])
);

// Or load from File: 
/*const keypair = new Uint8Array(
  JSON.parse(
    fs.readFileSync("shoUzmg5H2zDdevxS6UdQCiY6JnP1qSn7fPtCP726pR.json").toString())
  );
  let keyPair = Keypair.fromSecretKey(decodedKey);
*/

let wallet = new anchor.Wallet(keypair);
const provider = new anchor.AnchorProvider(connection, wallet, {
  commitment: "confirmed",
});
anchor.setProvider(provider);

const program = new Program<SolanaBar>(IDL, "GCgyx9JPNpqX97iWQh7rqPjaignahkS8DqQGdDdfXsPQ", { connection })

console.log("Program ID", program.programId.toString());

startListeningToLedSwitchAccount();

async function startListeningToLedSwitchAccount() {
    const receiptsPDA = await anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("receipts"),
        ],
        program.programId,
      )[0];

    const receiptsAccount = await program.account.receipts.fetch(
        receiptsPDA
    )

    console.log("Receipts account", JSON.stringify(receiptsAccount));

    for (let i = 0; i < receiptsAccount.receipts.length; i++) {
      const receipt = receiptsAccount.receipts[i];
      if (!receipt.wasDelivered) {
        await PourShotAndMarkAsDelivered(receipt);
        console.log("Receipt", JSON.stringify(receipt));
        break;
      }
    }
    
    GPIO_23.writeSync(0);
    
    connection.onAccountChange(receiptsPDA, async (account) => {
        const decoded = program.coder.accounts.decode(
            "receipts",
            account.data
          )

          for (let i = 0; i < decoded.receipts.length; i++) {
            const receipt = decoded.receipts[i];
            if (!receipt.wasDelivered) {
              await PourShotAndMarkAsDelivered(receipt);
              break;
            }
          }

        console.log("Shot given out: ");
    }, "confirmed")

  async function PourShotAndMarkAsDelivered(receipt: { receiptId: anchor.BN; buyer: anchor.web3.PublicKey; wasDelivered: boolean; price: anchor.BN; timestamp: anchor.BN; }) {
    console.log("start puring receipt id: " + receipt.receiptId.toString());
    
    GPIO_23.writeSync(1);
    await sleep(3000);
    GPIO_23.writeSync(0);

    console.log("done puring: " + receipt.receiptId.toString());

    let ix = await program.methods.markShotAsDelivered(receipt.receiptId).accounts(
      {
        receipts: receiptsPDA,
        signer: wallet.publicKey,
      }).transaction();

      console.log("ix", JSON.stringify(ix));
      ix.feePayer = wallet.publicKey;
      var signature = await connection.sendTransaction(ix, [keypair], {skipPreflight: true});

      console.log("Sent receipt mark as delivered: ", signature);
  }

    function sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
  }
};
