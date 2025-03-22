# Solana DePin Examples

This repository contains examples of how to use Solana to talk to hardware. 
DePin stands for decentralized physical infrastructure and is a term which describes the use of blockchain technology to manage physical infrastructure.

## Examples

### [Led-Switch](./led-switch/README.md)

This example shows how to use Solana Pay transaction requests to control a LED connected to a Raspberry Pi.
It comes with a full walkthrough from start to finish. Setting up the Raspberry Pi, deploying a Solana program, creating the QR codes to change the account and finally running the client code to control the LED.
[Twitter Video](https://twitter.com/solana_devs/status/1691563319457403301)

### [Solana-bar](./solana-bar/README.md)

This example shows how to use Solana Pay transaction requests to sell liquids decentralized using a 5V pump.
It comes with a full walkthrough from start to finish. Hardware requirements, how to attach the cables and the full source code. 
Take the liquid dispenser to the beach or a party and start selling holy water to your friends.
[Twitter Video](https://twitter.com/solana_devs/status/1697023233789145421)

### [Helium-Lorawan-Sensor-Chest](./helium-lorawan-chest/README.md)
This example shows how to use the helium network, which is powered by Solana, to create a chest which is only lootable via Solana Pay Transaction requests when the chest is physically open. 
It comes with a whole walkthrough of how to setup the sensor, create the api and the solana pay transaction requests. 
[Twitter Video](https://x.com/solana_devs/status/1707043184373637411)

### [Rust based esp32 Solana tracker with display](https://github.com/Mantistc/esp32-ssd1306-solana) 
Show Solana real-time data in a little ssd1306 display using the microcontroller esp32 to manage wifi, http request and more.
[Twitter Video](https://x.com/lich01_/status/1899208452167102621)  

### [Unruggable ESP32 Solana Hardware Signer](https://github.com/hogyzen12/unruggable-rust-esp32)
This example demonstrates how to build a low-cost hardware wallet using an ESP32 microcontroller that can securely sign Solana transactions. The ESP32 generates and stores a private key, requiring physical button confirmation for transaction signing. The project includes firmware for the ESP32 (written in Rust) and companion clis in Rust, Go for creating and submitting transactions.
[Twitter Video](https://x.com/bill_papas_12/status/1903308186498596979)