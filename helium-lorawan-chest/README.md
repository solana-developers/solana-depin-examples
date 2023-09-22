# Helium Lorawan door sensor Chest 

This is an example of a chest with qr code which only works when the chest is open. 
It uses a Helium Lorawan door sensor which writes its state in the state of an anchor program.
It can also be extended by connecting it to a raspberry pi and a LED.


## Hardware Required

A Lorawan magnetic Door sensor LDS02 (There are many resellers, just google it)): 
https://www.reichelt.de/lorawan-tuer-und-fenstersensor-dra-lds02-p311270.html



## Setup Helium Lorawan door sensor

... TODO

## The program

The program is a small anchor program which has a boolean which indicated if the chest is currently open or close.
Note that the program is not yet connected to the LED. We will do that later.
Also the seed for the chest account is just a string, so everyone can call this function and switch it on or off. You could add a public key or any other string here to have only certain wallets able to open the chest.

```rust
use anchor_lang::prelude::*;

declare_id!("2UYaB7aU7ZPA5LEQh3ZtWzC1MqgLkEJ3nBKebGUrFU3f");

#[error_code]
pub enum LorawanChestError {
    ChestIsClosed = 100,
}

#[program]
pub mod lorawan_chest {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        ctx.accounts.lorawan_chest.is_open = false;
        Ok(())
    }

    pub fn switch(ctx: Context<Switch>, is_on: bool) -> Result<()> {
        // Here you may want to add a check that only your API is allowed to open and close the chest. Otherwise everyone could call this function and open the chest.
        ctx.accounts.lorawan_chest.is_open = is_on;
        Ok(())
    }

    pub fn loot(ctx: Context<Switch>) -> Result<()> {
        if !ctx.accounts.lorawan_chest.is_open {
            return Err(LorawanChestError::ChestIsClosed.into());
        }

        // Add any kind of loot action here. For the example we have a simple log.
        // We also have a transfer instruction in the next.js api, but you can also add it in the program. 
        // Or you could save per user here which chests he already collected, or mint an NFT for example.
        msg!("Looted!");

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, space = 8 + 8, seeds = [b"lorawan_chest"], bump)]
    pub lorawan_chest: Account<'info, LorawanChest>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Switch<'info> {
    #[account(mut, seeds = [b"lorawan_chest"], bump)]
    pub lorawan_chest: Account<'info, LorawanChest>,
    #[account(mut)]
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct Loot<'info> {
    #[account(mut, seeds = [b"lorawan_chest"], bump)]
    pub lorawan_chest: Account<'info, LorawanChest>,
    #[account(mut)]
    pub authority: Signer<'info>,
}

#[account]
pub struct LorawanChest {
    pub is_open: bool,
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



## Optional step: Show the status of the chest with an LED

Optional to show the current status of the chest with an LED:
A Raspberry Pi 4B with WiFi connection, a LED and a 220 ohm resistor.
A 32 Gb mini sd card for the raspberry OS. 

For example: 
https://www.amazon.de/dp/B0C7KXMP7W
https://www.amazon.de/dp/B07WYX8M76

There maybe cheaper and better options. This is an example, any Raspberry 4b and any starter kit with a LED and a resistor will do. Probably a raspberry nano/pico or similar would also work.


### Setup Raspberry

Insert the SD card into your computer. 

Install the Raspberry OS from here: https://www.raspberrypi.com/software/

Make sure to add the correct wifi information and the user and password and enable SSH. Otherwise you will need a monitor to connect to it later. 

Write the os onto the sd card with the Raspberry Pi image and then put the sd card into the raspberry pi and connect it to a power source. 

<img width="675" alt="Bildschirmfoto 2023-08-14 um 15 10 09" src="https://github.com/solana-developers/solana-depin-examples/assets/5938789/98163c44-4de8-4366-82bd-dae89599ed6b">

#### optional switch wifi access via ethernet cable

If you did not setup the wifi password in the setup you can also connect the raspberry pi via lan cable to your router and then ssh into it. This is also helpful if you want to connect to it from a different network if you move somewhere else. 
- Connect your computer via lan cable to the raspberry pi (Probably need a connector from usb-c to lan)
- ssh jonas@raspberrypi.local
- sudo raspi-config and change under system -> wifi to the new wifi network by adding the SSID and the password

### Quick blinking test

Connect pin 18 to one side of the LED with a 220 Ohm resistor and pin 16 to the other side like so: 
<img width="675" alt="Bildschirmfoto 2023-08-14 um 15 10 09" src="https://github.com/solana-developers/solana-depin-examples/assets/5938789/4d1ba27f-1f8d-46b8-9e1e-f5caed89c040">
<img width="675" alt="Bildschirmfoto 2023-08-14 um 15 10 09" src="https://github.com/solana-developers/solana-depin-examples/assets/5938789/54918894-4d34-457b-b518-d8bc3c37a597">

open terminal 

```console 
ping raspberrypi.local -> Copy ip address
ssh yourUserName@TheCopiedIpAddress (ssh jonas@192.168.1.183)

cd Documents 
nano LED.py
```

Copy this in the File: 

```python
import RPi.GPIO as GPIO
import time
GPIO.setmode(GPIO.BCM)
GPIO.setwarnings(False)
GPIO.setup(18,GPIO.OUT)
print ("LED on")
GPIO.output(18,GPIO.HIGH)
time.sleep(3)
print ("LED off")
GPIO.output(18,GPIO.LOW)
```

use ctrl +x to exit and y to save

sudo python LED.py

If everything is set up correctly the LED should blink for 3 seconds.


### Install Node on the Raspberry Pi:

We want to use js so we can easily use the Solana web3 library.

1. Type the command:
```console
sudo apt update
```

2. Then, install Node.js with the command:
```console
sudo apt install nodejs
```

3. Confirm that the installation was successful by checking the available version:
```console
nodejs -v
```

4. Install the Node.js package manager (npm):
```console
sudo apt install npm 
```

5. Verify the installed version:
```console
npm -v
```

Install nvm: (https://github.com/nvm-sh/nvm)

```console
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.4/install.sh | bash
```

```console
export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s "${XDG_CONFIG_HOME}/nvm")"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" # This loads nvm
```

```console
nvm install 16.19.1
nvm use 16.19.1
node --version
```

### Blink script in Node.js

```console
mkdir led
cd led
npm install onoff
nano blink.js
```

Paste the following code in the file:

```js
var Gpio = require('onoff').Gpio; //include onoff to interact with the GPIO
var LED = new Gpio(18, 'out'); //use GPIO pin 18, and specify that it is output
var blinkInterval = setInterval(blinkLED, 250); //run the blinkLED function every 250ms

function blinkLED() { //function to start blinking
  if (LED.readSync() === 0) { //check the pin state, if the state is 0 (or off)
    LED.writeSync(1); //set pin state to 1 (turn LED on)
  } else {
    LED.writeSync(0); //set pin state to 0 (turn LED off)
  }
}

function endBlink() { //function to stop blinking
  clearInterval(blinkInterval); // Stop blink intervals
  LED.writeSync(0); // Turn LED off
  LED.unexport(); // Unexport GPIO to free resources
}
setTimeout(endBlink, 5000); //stop blinking after 5 seconds
```

run it with:

```console
sudo node blink.js
```

