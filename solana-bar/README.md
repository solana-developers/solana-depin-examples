# Solana Bar 

Project name Dionysos.  
Example that shows how you can sell liquids via Solana Pay. 
Dionysos was the god of wine, fertility, ritual madness, religious ecstasy, and theatre in ancient Greek religion and myth. 
He would have loved this project. 


## Prerequisites

If you have not worked with raspberry pi before its highly recommended to do the LED-switch example first for the complete setup of the PI including node and typescript.
Here is the link: 
<LINK TO LED-SWITCH EXAMPLE>


## Hardware Required

A Raspberry Pi 4B with WiFi connection, a water pump and a 220 ohm resistor and a NPN transistor.
A 32 Gb mini sd card for the raspberry OS. 
If you want to run the bar anywhere, you also need a power bank to power the raspberry pi.

- Raspberry Pi 4B (or similar) with WiFi connection
- 5V Water pump
- 220 Ohm resistor (is part of the raspberry starter kit)
- NPN transistor (S8050 D331, is part of the raspberry starter kit. Its the one with the little H on the back)
- 32 Gb mini sd card
- Power bank (optional)

For example: 

https://www.amazon.de/dp/B0C7KXMP7W
https://www.amazon.de/dp/B07WYX8M76
There maybe cheaper and better options for these two. This is an example, any Raspberry 4b and any starter kit with a LED and a resistor will do. Probably a raspberry nano/pico or similar would also work.

Pump + moisture sensor (Sensor is not used in this example, but you could use it to check if there is still liquid in the container):
https://www.amazon.de/dp/B07TQ6TP55

## Setup Raspberry

See <LED-SWITCH EXAMPLE> for the complete setup of the PI including node and typescript.


## Install Node on the Raspberry Pi:

See <LED-SWITCH EXAMPLE> for the complete setup of the PI including node and typescript.

## The program

The program is a small anchor program which has a boolean which indicated if the LED should be on or off.
Not that the program is not yet connected to the LED. We will do that later.
Also the seed for the LED account is just a string, so everyone can call this function and switch it on or off. You could add a public key or any other string here to have only certain wallets able to switch the LED on or off.

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

    // This instruction will be called from the raspberry pi as soon as he is done purring the drink.
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

## Now we want to listen to the account via websocket and trigger the LED

Use scp or rsync to copy the files from the raspberry folder to the raspberry pi.
(If you have problems coping files like i had you can also use VNC Viewer to copy the files.)
Notice that you need to copy the anchor types from the target folder to the raspberry folder whenever you do changes. (I didn't manage to get it to work without copying the types file over next to the led.ts file.) 

Then maybe you need to install node types and type script. 

```console
npm install -D typescript
npm install -D ts-node
```

Then you can run 

```console
npm i 
and then run the script led.ts 
npx ts-node led.ts
```

Don't run it with sudo. That gave me problems.
You may need to change the rights of the directory to be able to write to it:
```console
chmod -R 777 /directory
```

Now the LED will already have the correct state that is in the LED account. Next we gonna change it via Solana Pay Transaction requests.

```js
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { IDL, LedSwitch } from "../target/types/led_switch";
import { clusterApiUrl, Connection, Keypair, PublicKey } from "@solana/web3.js";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";

var Gpio = require('onoff').Gpio; //include onoff to interact with the GPIO
var LED = new Gpio(18, 'out'); //use GPIO pin 18, and specify that it is output

let connection = new Connection(clusterApiUrl("devnet"));
let wallet = new NodeWallet(new Keypair());
const provider = new anchor.AnchorProvider(connection, wallet, {
  commitment: "processed",
});
anchor.setProvider(provider);

const program = new Program<LedSwitch>(IDL, "F7F5ZTEMU6d5Ac8CQEJKBGWXLbte1jK2Kodyu3tNtvaj", { connection })

console.log("Program ID", program.programId.toString());

startListeningToLedSwitchAccount();

async function startListeningToLedSwitchAccount() {
    const ledSwitchPDA = await anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("led-switch"),
        ],
        program.programId,
      )[0];

    const ledSwitchAccount = await program.account.ledSwitch.fetch(
        ledSwitchPDA
    )

    console.log(JSON.stringify(ledSwitchAccount));
    console.log("Led is: ", ledSwitchAccount.isOn);
    if (ledSwitchAccount.isOn) {
      LED.writeSync(1);
    } else {
      LED.writeSync(0);
    }
    
    connection.onAccountChange(ledSwitchPDA, (account) => {
        const decoded = program.coder.accounts.decode(
            "ledSwitch",
            account.data
          )

          if (decoded.isOn) {
            LED.writeSync(1);
          } else {
            LED.writeSync(0);
          }
        console.log("Account changed. Led is: ", decoded.isOn);
    }, "processed")
};
```

Now the LED will always show the state of the LED account. Next we gonna change the state of the LED account via Solana Pay Transaction requests.

## Create a Solana Pay Transaction Request

Solana Pay is not only for payments, but can request any transaction to be signed. 
The transaction can be signed by any wallet that supports Solana Pay. 
It consists of two parts. The api which can be found in led-switch/app/pages/api/transaction.ts and the creation of the QR code which can be found in led-switch/app/app/page.tsx and the QrCode in led-switch/app/app/components/qr-code.tsx. 

Basically what is happening is that the wallet sends a get request to our API to get a name and icon and then the transaction is created in the nextJS api and send to the wallet. The wallet then signs it. When the transaction is confirmed the LED account is updated and since on the raspberry pi we have a websocket connection to that account the LED turns on or off.

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
Now the QR code should work and switch the LED on and off. 

Now you can also copy and print the QR codes and glue them somewhere next to the LED for example. 


## Deploy 

Since you don't want to run ngrok every time it makes sense to deploy the app. Either on the raspberry itself or on for example vercel.com. 


## Where to go from here


Now you just need imagination to think of what you can do with this.
For example you could create a game where you have to scan the QR code to switch the LED on and off or control switches and ramps for marbles.
Or you could use a lock to open a door. Or even only open it when there is certain NFT in that wallet. 
Or you could use it to water plants or feed a hamster during a live stream. 
Or attach it to a car which can be controlled by the audience.

Have fun and let me know what you build with it! 




### Optional step: auto start the script on boot (WIP)

Here are three ways on how to start the script on boot:
https://www.makeuseof.com/how-to-run-a-raspberry-pi-program-script-at-startup/

I went for step 2 the cron job since it didn't want to risk there being problems during the startup.

First I created a start.sh file:
```bash
nano /home/jonas/Documents/led-switch/led-switch/raspberry/start.sh
```
add 
```bash
npx ts-node /home/jonas/Documents/led-switch/led-switch/raspberry/led.ts
```
then run
```bash
chmod +x /home/jonas/Documents/led-switch/led-switch/raspberry/start.sh
```

Then I added this line to the cron config: 

```bash
crontab -e
@reboot sleep 10 && /home/jonas/Documents/led-switch/led-switch/raspberry/start.sh &
```

To enable cron logs 
```bash
sudo nano /etc/rsyslog.conf
```
and uncomment the line 
```bash
# cron.*                          /var/log/cron.log
```
Then restart the service
```bash
sudo service rsyslog restart
```
Now you can check the logs with 
```bash
sudo cat /var/log/cron.log
```
Now reboot the raspberry and check if the LED is turning on. (Make sure the program state is set to true ;) )
```bash
sudo reboot
```

If you get error saying that the package crypto is not available its probably because your sude node version is too low.
You can check the node version with 
```bash
sudo node -v
```
Update it as described above just using sudo command. 





