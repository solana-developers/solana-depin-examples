# Helium Lorawan door sensor Chest 

This is an example of a chest with qr code which only works when the chest is open. 
It uses a Helium Lorawan door sensor which writes its state in the state of an anchor program.
It can also be extended by connecting it to a raspberry pi and a LED.

<img width="1393" alt="image" src="https://github.com/solana-developers/solana-depin-examples/assets/5938789/23ec892e-0fde-4c67-9fee-727e535375d2">


This project consists of three parts: 
- The Helium Lorawan door sensor which sends the state of the chest to the Helium console.
- An API which listens to the door sensor and updates the state of the anchor program.
- The Solana Pay Transaction request api which creates a QR code which can be scanned by any mobile wallet that supports Solana Pay to loot the chest.
- Optional: A Raspberry Pi with a LED which listens to the state of the anchor program and turns an LED on or off.

## Hardware Required

A Lorawan magnetic Door sensor LDS02 (There are many resellers, just google it)): 
https://www.reichelt.de/lorawan-tuer-und-fenstersensor-dra-lds02-p311270.html

If you want to attach a raspberry pi to the chest please follow the led-switch example:
[LED-SWITCH-EXAMPLE
](https://github.com/solana-developers/solana-depin-examples/blob/main/led-switch/README.md)

## Setup Helium Lorawan door sensor

Add betteries into your sensor. I little green LED will indicate that its trying to connect to the helium network.

When you order a lorawan sensor it comes with a little paper with 3 ids on it.
Device EUI, App EUI and App Key.

These you need to add into the Helium console: 
[Devices](https://console.helium.com/devices)

<img width="1249" alt="image" src="https://github.com/solana-developers/solana-depin-examples/assets/5938789/2f0ecf92-87bb-4e5c-a088-3daf27ed566c">

Then you need to find the decoder for your sensor on its user manual. 
In our case you will find it here under uplink: 
[Sensor Data Sheet](http://wiki.dragino.com/xwiki/bin/view/Main/User%20Manual%20for%20LoRaWAN%20End%20Nodes/LDS02%20-%20LoRaWAN%20Door%20Sensor%20User%20Manual/#H4.3UplinkPayload)

Which will lead you to: 
https://github.com/dragino/dragino-end-node-decoder/tree/main/LDS02

There you can download the ttn (The Things Network) decoder. I used version 1.5 which is compatible.
Then you can add the decoder to the Helium console under functions.

<img width="1906" alt="image" src="https://github.com/solana-developers/solana-depin-examples/assets/5938789/10c10a9a-8cf0-4845-a356-a52fc6bc3edd">


Last thing we need to do is to create an HTTP integration so that the Helium console sends the data to our API.
For that you pick http integration and add the url of your api. The API link we will create in the next step. You can change it later.

<img width="1835" alt="image" src="https://github.com/solana-developers/solana-depin-examples/assets/5938789/92925bef-7c5c-4c7c-8489-136065a7d139">


Then under flows you add the device, then plug it into the decoder and then plug it into the http integration. Like that the api will be called every time the sensor sends data and the data will already arrive decoded. 

<img width="1190" alt="image" src="https://github.com/solana-developers/solana-depin-examples/assets/5938789/7810d085-be8a-4bae-bb5b-6af834ddd1c2">

Start your API using 

```bash
cd app
yarn dev
```

Use ngrok to make your API publically available or deploy to vercel: 
https://ngrok.com/product

```bash
ngrok http 3000
```

https://vercel.com/

Copy the url to your api into the http integration in the helium console. 

If you did the integration correctly you should be seeing an out put similar to this in your api:
So you have all the information about the sensor. You can also for example use the door open duration or the amount of door open to add more logic to your chest. 

```bash
Door is open: {
  app_eui: '...',
  dc: { balance: 189, nonce: 1 },
  decoded: {
    payload: {
      ALARM: 0,
      BAT_V: 3.174,
      DOOR_OPEN_STATUS: 0,
      DOOR_OPEN_TIMES: 28,
      LAST_DOOR_OPEN_DURATION: 0,
      MOD: 1
    },
    status: 'success'
  },
  dev_eui: '...',
  devaddr: '03000048',
  downlink_url: 'https://console.helium.com/api/v1/down/....',
  fcnt: 53,
  hotspots: [
    {
      channel: 5,
      frequency: 868.1,
      hold_time: 0,
      id: '???????',
      lat: xxx,
      long: yyy,
      name: '????-????-????',
      reported_at: 1695491235713,
      rssi: -131,
      snr: -13.5,
      spreading: 'SF12BW125',
      status: 'success'
    }
  ],
  id: 'ID...',
  metadata: {
    adr_allowed: false,
    cf_list_enabled: false,
    multi_buy: 1,
    organization_id: 'ID...'
    preferred_hotspots: [],
    rx_delay: 1,
    rx_delay_actual: 1,
    rx_delay_state: 'rx_delay_established'
  },
  name: 'Door Sensor',
  payload: 'DGYBAAAcAAAAAA==',
  payload_size: 10,
  port: 10,
  raw_packet: 'QAMAAEiANQAK5yx+wU+dOzSfMkpVL9c=',
  replay: false,
  reported_at: 1695491235713,
  type: 'uplink',
  uuid: 'id...'
}
```

## The sensor API 

The API changing the state in the program you can find here: 
[Downling api](https://github.com/solana-developers/solana-depin-examples/blob/main/helium-lorawan-chest/app/pages/api/sensor-downlink.ts)

We use a local keypair which writes the current state of sensor in the state of the lorawan_chest anchor program. 
The program will only allow changs coming from this key pair. So if you want to chagne the key pair you may need to adjust also the admin key in the anchor program. 

```js
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
```


## The program

The program is a small anchor program which has a boolean which indicated if the chest is currently open or close.
Note that the program is not yet connected to the LED. We will do that later.
Also the seed for the chest account is just a string, so everyone can call this function and switch it on or off. You could add a public key or any other string here to have only certain wallets able to open the chest.

```rust
use anchor_lang::prelude::*;
use solana_program::pubkey;

declare_id!("2UYaB7aU7ZPA5LEQh3ZtWzC1MqgLkEJ3nBKebGUrFU3f");

// Change this to what ever key you use in your API to make sure not everyone can just call the switch function.
const ADMIN_PUBKEY: Pubkey = pubkey!("LorBisZjmXHAdUnAWKfBiVh84yaxGVF2WY6kjr7AQu5");

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
        // Note that the account which will be able to change the state if this account is only the admin account.
        ctx.accounts.lorawan_chest.is_open = is_on;
        Ok(())
    }

    pub fn loot(ctx: Context<Switch>) -> Result<()> {
        if !ctx.accounts.lorawan_chest.is_open {
            return Err(LorawanChestError::ChestIsClosed.into());
        }

        // You can add any kind of loot action here.
        // In the next js api we add a transfer, but you could also mint an NFT for example.
        // Or you could save per user here which chests he already collected and build some real live adventure game.
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
    #[account(mut, address = ADMIN_PUBKEY)] // <- Note that here we check for the admin account. 
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


## Create a Solana Pay Transaction Request

Solana Pay is not only for payments, but can request any transaction to be signed. 
The transaction can be signed by any wallet that supports Solana Pay. Especially useful on mobile. 
It consists of two parts. The api which can be found in lorawan-chest/app/pages/api/transaction.ts and the creation of the QR code which can be found in lorawan-chest/app/app/page.tsx and the QrCode in lorawan-chest/app/app/components/qr-code.tsx. 

Basically what is happening is that the wallet sends a get request to our API to get a name and icon and then the transaction is created in the nextJS api and send to the wallet. The wallet then signs it. When the transaction is confirmed the chest is looted. We add two instructions. One is a transfer of sol and one is the loot instruction to our anchor program. The Loot instruction will only work if the chest is open. 

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

Now you can also copy and print the QR codes and glue them somewhere into the chest for example. 


## Deploy 

Since you don't want to run ngrok every time it makes sense to deploy the app. You can deploy it to vercel and update the link to your api in the Helium console. 


## Where to go from here

There are many many different sensors that you can use for your depin projects.
Here is a list of ready to use sensors. There are temperature, humidity and many other sensors. 
Some ideas that you could do with them:
- A chest that only opens when the temperature is below 0 degrees of when its raining.
- You could use distance senors to figure out if there are free parking spots in a city and have an app which shows you where you can park.
- You could use a light sensor to figure out if a room is occupied or not.
- You use downlinks and solana pay QR codes to control a robot car or a drone. 
- You could build a live stream where people can control robots via qr codes and let them fight against each other.
- You could build a smart package by building a tiny lorawan sensor and put it in reusable packages. Like that I would not need to wait at home anymore when i am about to recieve a package, but could instead just get a notification when the package is delivered and then go and pick it up. kastzentracker.eu is building tiny sensors to track cats for example. 
- You could build a warning system for nature catastrophes like floods or fires.
- You could build a vending machine using solana pay qr codes 


## Optional step: Show the status of the chest with an LED using a raspberry pi

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
import { IDL, LorwawanChest } from "../target/types/lorwan_chest";
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

const program = new Program<LorwawanChest>(IDL, "2UYaB7aU7ZPA5LEQh3ZtWzC1MqgLkEJ3nBKebGUrFU3f", { connection })

console.log("Program ID", program.programId.toString());

startListeningToLedSwitchAccount();

async function startListeningToLedSwitchAccount() {
    const lorawanChestPDA = await anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("lorawan_chest"),
        ],
        program.programId,
      )[0];

    const lorawanChestAccount = await program.account.lorawanChest.fetch(
        lorawanChestPDA
    )

    console.log(JSON.stringify(lorawanChestAccount));
    console.log("Led is: ", lorawanChestAccount.isOpen);
    if (ledSwitchAccount.isOpen) {
      LED.writeSync(1);
    } else {
      LED.writeSync(0);
    }
    
    connection.onAccountChange(lorawanChestPDA, (account) => {
        const decoded = program.coder.accounts.decode(
            "lorawanChest",
            account.data
          )

          if (decoded.isOpen) {
            LED.writeSync(1);
          } else {
            LED.writeSync(0);
          }
        console.log("Account changed. Chest is: ", decoded.isOpen);
    }, "processed")
};
```

When you run this script on your raspberry pi the LED will always show the state of the ChestAccount account. This is a nice indicator that the chest is currently open and the QR code can be scanned. 

