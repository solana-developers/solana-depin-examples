# Solana Bar 

Project name Dionysos.  
Example that shows how you can sell wine or and other liquids via Solana Pay transaction requests qr codes. 
Dionysos was the god of wine, fertility, ritual madness, religious ecstasy, and theatre in ancient Greek religion and myth. 
He would have loved this project. 

![IMG_2731](https://github.com/solana-developers/solana-depin-examples/assets/5938789/29bc21c9-1428-4252-93a6-a12c85b8260a)


## Prerequisites

If you have not worked with raspberry pi before its highly recommended to do the LED-switch example first for the complete setup of the PI including node and typescript.
Here is the link: 
[LED-SWITCH-EXAMPLE
](https://github.com/solana-developers/solana-depin-examples/blob/main/led-switch/README.md)


## Hardware Required

A Raspberry Pi 4B with WiFi connection, a water pump and a 220 ohm resistor and a NPN transistor.
A 32 Gb mini sd card for the raspberry OS. 
If you want to run the bar anywhere, you also need a power bank to power the raspberry pi.

- Raspberry Pi 4B (or similar) with WiFi connection
- 5V Water pump
- 220 Ohm resistor (is part of the raspberry starter kit)
- NPN transistor (S8050 D331, is part of the raspberry starter kit. It's the one with the little H on the back)
- 32 Gb mini sd card
- Power bank (optional)

For example: 

https://www.amazon.de/dp/B0C7KXMP7W
https://www.amazon.de/dp/B07WYX8M76
There may be cheaper and better options for these two. This is an example, any Raspberry 4b and any starter kit with a LED and a resistor will do. Probably a raspberry nano/pico or similar would also work.

Pump + moisture sensor (Sensor is not used in this example, but you could use it to check if there is still liquid in the container):
https://www.amazon.de/dp/B07TQ6TP55

## Setup Raspberry

See [LED-SWITCH-EXAMPLE
](https://github.com/solana-developers/solana-depin-examples/blob/main/led-switch/README.md)
 for the complete setup of the PI including node and typescript.


## Install Node on the Raspberry Pi:

See [LED-SWITCH-EXAMPLE
](https://github.com/solana-developers/solana-depin-examples/blob/main/led-switch/README.md)
 for the complete setup of the PI including node and typescript.

## Power supply 

The water pump may have come with a relay. That is not really needed though. You can just use the power supply of the raspberry pi. 
We use a NPN Transistor from the Raspberry pi starter kit. (S8050 D331 the one with the little H on it) Attach the left side, the collector, to ground pin which is pin number three on the right side. Then the positive part to the collector of the transistor. Then you attach GPIO 23 via a resistor to the base of the transistor. 
What is happening here is that the GPIO pin will be loaded positive as soon as the GPIO pin is activated in our ts code. This basically makes the transistor conductive and the power can freely flow from plus to ground through the pump which makes it pump. 

![IMG_2733](https://github.com/solana-developers/solana-depin-examples/assets/5938789/c2972057-4e68-47a3-aaf4-538686c5ae03)
![IMG_2735](https://github.com/solana-developers/solana-depin-examples/assets/5938789/d09fe43a-6792-432f-8483-bce2c36d4c5d)

This is already the whole setup we need. Now just find a nice spot for your pump and attach the raspberry with a power bank so it looks like the wine is controlled by magic. 

## The anchor program

The program is written in Rust using the Anchor framework.
It consists of two parts. The first part is the program that runs on the blockchain and the second part is the program that runs on the raspberry pi.
The program has a function to buy a shot and a function to mark the shot as delivered.
When scanning the QR code a transaction request is created that calls the buy shot function by signing a transaction on the users mobile wallet. 
When the raspberry pi receives the transaction request it will turn on the pump and wait for a certain amount of time. 
Then it will call the mark shot as delivered function.
This program can be easily expanded to have multiple pumps and multiple drinks. The receipts can be used to track how much was sold for accounting. 

```rust
use anchor_lang::solana_program::native_token::LAMPORTS_PER_SOL;
use anchor_lang::system_program;
use anchor_lang::{prelude::*, solana_program::pubkey};

declare_id!("GCgyx9JPNpqX97iWQh7rqPjaignahkS8DqQGdDdfXsPQ");

// This is where the payments for drinks will be send to. 
const TREASURE_PUBKEY: Pubkey = pubkey!("GsfNSuZFrT2r4xzSndnCSs9tTXwt47etPqU8yFVnDcXd");

#[error_code]
pub enum ShotErrorCode {
    #[msg("InvalidTreasury")]
    InvalidTreasury,
}

#[program]
pub mod solana_bar {

    use super::*;
    const SHOT_PRICE: u64 = LAMPORTS_PER_SOL / 10; // 0.1 SOL

    pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }

    pub fn buy_shot(ctx: Context<BuyShot>) -> Result<()> {
        if TREASURE_PUBKEY != *ctx.accounts.treasury.key {
            return Err(ShotErrorCode::InvalidTreasury.into());
        }

        // Add a new receipt to the receipts account.
        let receipt_id = ctx.accounts.receipts.total_shots_sold;
        ctx.accounts.receipts.receipts.push(Receipt {
            buyer: *ctx.accounts.signer.key,
            was_delivered: false,
            price: 1,
            timestamp: Clock::get()?.unix_timestamp,
            receipt_id,
        });

        // Change this number to how many receipts you want to save on chain.
        let len = ctx.accounts.receipts.receipts.len();
        if len >= 10 {
            ctx.accounts.receipts.receipts.remove(0);
        }

        // Increment the total shots sold.
        ctx.accounts.receipts.total_shots_sold = ctx
            .accounts
            .receipts
            .total_shots_sold
            .checked_add(1)
            .unwrap();

        // Transfer lamports to the treasury for payment.
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.signer.to_account_info().clone(),
                to: ctx.accounts.treasury.to_account_info().clone(),
            },
        );
        system_program::transfer(cpi_context, SHOT_PRICE)?;

        Ok(())
    }

    // This instruction will be called from the raspberry pi as soon as he is done purring the drink. For the very unlikely case that an attacker wants to mark a shot as delivered here a signer check could be added. 
    pub fn mark_shot_as_delivered(ctx: Context<MarkShotAsDelivered>, recipe_id: u64) -> Result<()> {
        for i in 0..ctx.accounts.receipts.receipts.len() {
            if ctx.accounts.receipts.receipts[i].receipt_id == recipe_id {
                msg!("Marked shot as delivered {} {} ", recipe_id, i);
                ctx.accounts.receipts.receipts[i].was_delivered = true;
            }
        }
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, space = 5000, seeds = [b"receipts"], bump)]
    pub receipts: Account<'info, Receipts>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct BuyShot<'info> {
    #[account(mut, seeds = [b"receipts"], bump)]
    pub receipts: Account<'info, Receipts>,
    #[account(mut)]
    pub signer: Signer<'info>,
    /// CHECK: checked against the treasury pubkey.
    #[account(mut)]
    pub treasury: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MarkShotAsDelivered<'info> {
    #[account(mut, seeds = [b"receipts"], bump)]
    pub receipts: Account<'info, Receipts>,
    #[account(mut)]
    pub signer: Signer<'info>,
}

#[account()]
pub struct Receipts {
    pub receipts: Vec<Receipt>,
    pub total_shots_sold: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct Receipt {
    pub receipt_id: u64,
    pub buyer: Pubkey,
    pub was_delivered: bool,
    pub price: u64,
    pub timestamp: i64,
}

```

## Raspberry PI script setup

See [LED-SWITCH-EXAMPLE
](https://github.com/solana-developers/solana-depin-examples/blob/main/led-switch/README.md)


## Raspberry PI script

The script is written in typescript and uses the anchor framework to interact with the blockchain. Make sure you copy the solana_bar types script next to the bar.ts script to be able to interact with the anchor program. 

This script is loading the receipts account and starts purring all drinks that are not delivered yet. Then it starts listening to the receipts account and purrs drinks as they are being bought. 

To purr a drink it activates GPIO 23 which is connected to a transistor is connected to a 5V line which is connected to the pump. The time to purr could be adjusted by adding a field for purr time for different drinks into the receipt account for example. 

After the drink is purred the script uses a hardcoded keypair to mark the drink as delivered. 


```js
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { IDL, SolanaBar } from "./solana_bar";
import { clusterApiUrl, Connection, Keypair, PublicKey } from "@solana/web3.js";

var Gpio = require('onoff').Gpio; //include onoff to interact with the GPIO
var GPIO_23 = new Gpio(23, 'out'); //use GPIO pin 18, and specify that it is output

let connection = new Connection(clusterApiUrl("devnet"));

// Replace this with your own keypair to be able to pay for fees to mark drinks as delivered.
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

        console.log("Shot given out.");
    }, "confirmed")

  async function PourShotAndMarkAsDelivered(receipt: { receiptId: anchor.BN; buyer: anchor.web3.PublicKey; wasDelivered: boolean; price: anchor.BN; timestamp: anchor.BN; }) {
    console.log("start purring receipt id: " + receipt.receiptId.toString());
    
    GPIO_23.writeSync(1);
    await sleep(3000);
    GPIO_23.writeSync(0);

    console.log("done purring: " + receipt.receiptId.toString());

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

```

## Create a Solana Pay Transaction Request

Solana Pay is not only for payments, but can request any transaction to be signed. 
The transaction can be signed by any wallet that supports Solana Pay. 
It consists of two parts. 
The api which can be found in solana-bar/app/pages/api/transaction.ts 

```js
if (instructionField == "buy_shot") {
    let ix = await SOLANA_BAR_PROGRAM.methods.buyShot().accounts(
      {
      receipts: RECEIPTS_PDA,
      signer: sender,
      treasury: new PublicKey("BRWrkVaTTyq3eRJw4t8YjkJuH9EtnoVeyeQ4A3eDqU86"),
      systemProgram: PublicKey.default,
      },
    ).instruction();
    
    transaction.add(ix);
    
    message = 'Buy 4 cl drink!';
  } else {
    message = 'Unknown instruction';
  }
```

and the creation of the QR code which can be found in 
solana-ar/app/app/page.tsx 

```js
  {receipts != null && (
    <PayQR instruction={"buy_shot"} />
  )}
```

and the QrCode in solan-bar/app/app/components/qr-code.tsx. 

```js
const queryBuilder = (baseUrl: string, params: string[][]) => {
  let url = baseUrl + '?';
  params.forEach((p, i) => url += p[0] + '=' + p[1] + (i != params.length - 1 ? '&' : ''));
  console.log(url)
  return url;
}

const PayQR: FC<TransactionRequestQRProps> = (
  { instruction }
) => {
  const qrRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const params = [
      ['instruction', instruction],
    ];

    const apiUrl = queryBuilder(
      `${window.location.protocol}//${window.location.host}/api/transaction`,
      params,
    );

    const qr = createQR(
      encodeURL({ link: new URL(apiUrl) }),
      360,
      'transparent'
    );

    qr.update({ backgroundOptions: { round: 1000 } });
    qr.update({ type: 'canvas' });

    if (qrRef.current != null) {
      qrRef.current.innerHTML = '';
      qr.append(qrRef.current)
    }

  }, [])
```

Basically what is happening is that the wallet sends a get request to our API to get a name and icon and then the transaction is created in the nextJS api and send to the wallet. The wallet then signs it. When the transaction is confirmed the new receipt is written into the receipt account is updated and since on the raspberry pi we have a websocket connection to that account the raspberry can start purring the drink. After he is done he will mark the drink as delivered. So like this we can make sure that the drink is only purred when the transaction is confirmed. In case of hardware errors we can issue a refund. 

To run the solana pay transaction request app use: 

```console
cd app
yarn install
yarn dev
```

open http://localhost:3000 in your browser.
Notice that the QR code is not working yet. We need to be able to access is from the distance. 
For that we use ngrok to create a tunnel to our local server.
Make an account and install ngrok https://ngrok.com/
open a terminal and type:
ngrok http 3000  
Then copy the url from the terminal and open it in the browser.
Now the QR code should work and scanning the QR code will start the pump. 

Now you can also copy and print the QR codes and glue them somewhere next to our Solana Bar for example. 


## Deploy 

Since you don't want to run ngrok every time it makes sense to deploy the app. Either on the raspberry itself or on for example vercel.com which is very convenient since you can directly deploy it from the github repository. 


## Where to go from here

Good additions would be to add a field for purr duration on the receipt account and to add a moisture sensor to check if there is still liquid in the container.

Build a nice case for it to hide the magic and shock your friends.

You can now also power the raspberry pi with a power bank and take it with you to the beach or a party and sell drinks there. You may want to connect it to your phones hotspot in that case.


### Optional step: auto start the script on boot

[LED-SWITCH-EXAMPLE
](https://github.com/solana-developers/solana-depin-examples/blob/main/led-switch/README.md)





