# Show current Solana Slot on OLED Display using Raspberry Pi

This example shows how you can use a Raspberry Pi to display the current Solana slot on an OLED display.

## Bill of Materials

- Raspberry Pi 5, 4 or zero
- OLED Display I2C - SSD1306 (For example: https://www.amazon.de/dp/B01L9GC470)

## Connect the OLED Display

First you need to enable I2C on the Raspberry Pi:

```bash
ssh yourUsername@raspberrypi.local
sudo raspi-config
```

Select `5 Interfacing Options` and then `I2C` and then `Yes` to enable it.

Connect the OLED Display to the Raspberry Pi using the following pins:

- VCC to 3.3V (pin 1)
- GND to GND (any ground pin will work. For example pin6 or pin9)
- SDA to GPIO 2 (pin 3)
- SCL to GPIO 3 (pin 5)

Make sure it works using:

```bash
sudo i2cdetect -y 1
```

That should show the address `0x3c` for the OLED Display somewhere in the list.

## Run the code

Copy the files to your Raspberry Pi.
Easiest is to use Cursor or VSCode with the Remote - SSH extension.
See the [LED example](https://github.com/solana-developers/solana-depin-examples/tree/main/led-switch) for more details on the raspberry pi setup and a Video Walkthrough.

Or use spc for copying the files (running on your machine):

```bash
scp hello-solana.js solana-slot.js package.json package-lock.json jonas@raspberrypi.local:~/Documents/
```

[Install node](https://github.com/solana-developers/solana-depin-examples/tree/main/led-switch#install-node-on-the-raspberry-pi)

Running on the Raspberry Pi:

```bash
npm install oled-i2c-bus i2c-bus oled-font-5x7 @solana/web3.js
```

```bash
sudo node solana-slot.js
```

This should not turn on the display and show the current slot.

Congratulations! You have now a Solana Slot Display!
Since this is just JS code you can also use it in all the other examples to show additional info. For example the price for a drink in the bar example or the progress bar for how long the Fan of the air blower will still run.
Just experiment and have fun!
