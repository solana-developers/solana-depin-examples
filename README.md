# Solana DePin & IOT Examples

This repository contains examples of how to use Solana to talk to hardware.
DePin stands for decentralized physical infrastructure and is a term which describes the use of blockchain technology to manage physical infrastructure.

## Examples

### [Reward Distribtution for hardware devices](https://github.com/Woody4618/depin-reward-distributor)

This example shows how you can use a raspberry pi temperature sensor and reward it with tokens. There is a ed25519 device identifier on the raspberry pi and an off chain oracle collecting the data and saving elegible reward count. For claiming the oracle signs a message that is validated in an Anchor program that distributes the tokens to the device owner. Cost per account is 0.0014 Sol per device. 

### [Data Anchor by Termina (Blob Upload + Verification)](./termina-data-anchor/README.md)

This example shows how DePIN teams can anchor large batches of device data (e.g., sensor readings and reward summaries) directly on Solana using Termina’s Data Anchor.
It demonstrates a full flow using the CLI from uploading a structured JSON blob, to fetching it from chain, and verifying its contents using a local script.
[Twitter Video](https://x.com/Terminaxyz/status/1909263420278394899)

### [Solana-bar V2](https://github.com/Woody4618/bar)

This example shows how you can sell drinks to anyone anywhere using Solana Pay Qr codes direclty from a bottle. 
It uses the web app letmebuy.app, an anchor program and a raspberry pi with a connected pump. 
The examples comes with complete source code and tutorial on how to build it yourself for under 100 dollar.
[Twitter Video](https://x.com/zCase_/status/1922321757693784198)

### [Unruggable ESP32 Solana Hardware Signer](https://github.com/hogyzen12/unruggable-rust-esp32)

This example demonstrates how to build a low-cost hardware wallet using an ESP32 microcontroller that can securely sign Solana transactions. The ESP32 generates and stores a private key, requiring physical button confirmation for transaction signing. The project includes firmware for the ESP32 (written in Rust) and companion clis in Rust, Go for creating and submitting transactions.
[Twitter Video](https://x.com/bill_papas_12/status/1903308186498596979)

### [Write Sensor Data on chain](https://x.com/priyansh_ptl18/status/1903940356070424825)

This example shows how to write sensor data to the chain using the Solana Pay transaction request. It reads the sensor data and saves it into an anchor program:
https://github.com/priyanshpatel18/aeroscan

https://github.com/priyanshpatel18/aeroscan-esp32

https://github.com/priyanshpatel18/aeroscan-ws

### [Helium-Lorawan-Sensor-Chest](./helium-lorawan-chest/README.md)

This example shows how to use the helium network, which is powered by Solana, to create a chest which is only lootable via Solana Pay Transaction requests when the chest is physically open.
It comes with a whole walkthrough of how to setup the sensor, create the api and the solana pay transaction requests.
[Twitter Video](https://x.com/solana_devs/status/1707043184373637411)


# IOT Examples

### [Rust based esp32 Solana tracker with display](https://github.com/Mantistc/esp32-ssd1306-solana)

Show Solana real-time data in a little ssd1306 display using the microcontroller esp32 to manage wifi, http request and more.
[Twitter Video](https://x.com/lich01_/status/1899208452167102621)

### [Solana slot LED-Display](https://github.com/solana-developers/solana-depin-examples/tree/main/Raspberry-LED-display)

This example shows use an LED Display to show the current Solana slot using a Raspberry Pi and a I2C - SSD1306.

### [Led-Switch](./led-switch/README.md)

This example shows how to use Solana Pay transaction requests to control a LED connected to a Raspberry Pi.
It comes with a full walkthrough from start to finish. Setting up the Raspberry Pi, deploying a Solana program, creating the QR codes to change the account and finally running the client code to control the LED.
[Twitter Video](https://twitter.com/solana_devs/status/1691563319457403301)

### [Solana-bar V1](./solana-bar/README.md)

This example shows how to use Solana Pay transaction requests to sell liquids decentralized using a 5V pump.
It comes with a full walkthrough from start to finish. Hardware requirements, how to attach the cables and the full source code.
Take the liquid dispenser to the beach or a party and start selling holy water to your friends.
[Twitter Video](https://twitter.com/solana_devs/status/1697023233789145421)


