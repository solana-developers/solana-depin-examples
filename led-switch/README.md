# Solana DePin Hello World 

In this example you will learn how to control a LED using Solana Pay Transaction Requests. 

## Hardware Required

A Raspberry Pi with WiFi connection, a LED and a 220 ohm resistor.

For example: 
https://www.amazon.de/dp/B0C7KXMP7W?psc=1&ref=ppx_yo2ov_dt_b_product_details
https://www.amazon.de/dp/B07WYX8M76?psc=1&ref=ppx_yo2ov_dt_b_product_details

## Quick blinking test

ping raspberrypi.local -> Copy ip address
ssh yourUserName@TheCopiedIpAddress (ssh jonas@192.168.1.183)

cd Documents 
nano LED.py

Copy this in the File: 

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

use ctrl +x to exit and y to save

sudo python LED.py

If everything is set up correctly the LED should blink for 3 seconds.


## Install Node on the Raspberry Pi:

We want to use js so we can easily use the solana web3 library.

1. Type the command:
```
sudo apt update
```

2. Then, install Node.js with the command:
```
sudo apt install nodejs
```

3. Confirm that the installation was successful by checking the available version:
```
nodejs -v
```

4. Install the Node.js package manager (npm):
```
sudo apt install npm 
```

5. Verify the installed version:
```
npm -v
```

Install nvm: (https://github.com/nvm-sh/nvm)

```
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.4/install.sh | bash
```

```
export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s "${XDG_CONFIG_HOME}/nvm")"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" # This loads nvm
```

```
nvm install 16.19.1
nvm use 16.19.1
node --version
```

## Blink script in Node.js


mkdir led
cd led
npm install onoff
nano blink.js

Paste the following code in the file:

```
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

```
sudo node blink.js
```

## The program

The program is a small anchor program which has a boolean which indicated if the LED should be on or off.
Not that the program is not yet connected to the LED. We will do that later.
Also the seed for the LED account is just a string, so everyone can call this function and switch it on or off. You could add a public key or any other string here to have only certain wallets able to switch the LED on or off.

```
use anchor_lang::prelude::*;

declare_id!("F7F5ZTEMU6d5Ac8CQEJKBGWXLbte1jK2Kodyu3tNtvaj");

#[program]
pub mod led_switch {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        ctx.accounts.led_switch.is_on = false;
        Ok(())
    }

    pub fn switch(ctx: Context<Switch>, is_on: bool) -> Result<()> {
        ctx.accounts.led_switch.is_on = is_on;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, space = 8 + 8, seeds = [b"led-switch"], bump)]
    pub led_switch: Account<'info, LedSwitch>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Switch<'info> {
    #[account(mut, seeds = [b"led-switch"], bump)]
    pub led_switch: Account<'info, LedSwitch>,
    #[account(mut)]
    pub authority: Signer<'info>,
}

#[account]
pub struct LedSwitch {
    pub is_on: bool,
}
```

## Now we want to listen to the account via websocket and trigger the LED

Use scp or rsync to copy the files from the raspberry folder to the raspberry pi.
(If you have problems coping files like i had you can also use VNC Viewer to copy the files.)
Notice that you need to copy the anchor types from the target folder to the raspberry folder whenever you do changes. (I didn't manage to get it to work without copying the files over to the led.ts file.) 

Then maybe you need to install node types and type script. 
npm install -D typescript
npm install -D ts-node

Then you can run 

npm i 
and then run the script led.ts 
npx ts-node led.ts

Don't run it with sudo. That gave me problems.
You may need to change the rights of the directory to be able to write to it:
chmod -R 777 /directory

Now the LED will already have the correct state that is in the LED account. Next we gonna change it via Solana Pay Transaction requests.

```
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

cd app
yarn install
yarn dev

open http://localhost:3000
Notice that the QR code is not working yet. We need to be able to access is from the distance. 
For that we use ngrok to create a tunnel to our local server.
Make an account and install ngrok https://ngrok.com/
open a terminal and type:
ngrok http 3000  
Then copy the url from the terminal and open it in the browser.
Now the QR code should work and switch the LED on and off. 

Now you can also copy and print the QR codes and glue them somewhere next to the LED for example. 



## Where to go from here


Now you just need imagination to think of what you can do with this.
For example you could create a game where you have to scan the QR code to switch the LED on and off or control switches and ramps for marbles.
Or you could use a lock to open a door. Or even only open it when there is certain NFT in that wallet. 
Or you could use it to water plants or feed a hamster during a live stream. 
Or attach it to a car which can be controlled by the audience.

Have fun and let me know what you build with it! 




### Optional step: auto start the script on boot (WIP)

Im still having some problems running ts-node as sudo. Still WIP.

Here are three ways on how to start the script on boot:
https://www.makeuseof.com/how-to-run-a-raspberry-pi-program-script-at-startup/

I went for step 2 the cron job since it didnt want to risk there being problems during the startup.

So I opened the ron config like so: 
```
```
and added this line: 
```
nano /home/jonas/Documents/led-switch/led-switch/raspberry/start.sh
add 
npx ts-node /home/jonas/Documents/led-switch/led-switch/raspberry/led.ts
chmod +x /home/jonas/Documents/led-switch/led-switch/raspberry/start.sh
```

Then I added this line to the cron config: 

```
sudo crontab -e
@reboot sleep 5 && /home/jonas/Documents/led-switch/led-switch/raspberry/start.sh &
```

To enable cron logs 
```
sudo nano /etc/rsyslog.conf
```
and uncomment the line 
```
# cron.*                          /var/log/cron.log
```
Then restart the service
```
sudo service rsyslog restart
```
Now you can check the logs with 
```
sudo cat /var/log/cron.log
```
Now reboot the raspberry and check if the LED is turning on. (Make sure the program state is set to true ;) )

```
sudo reboot
```


