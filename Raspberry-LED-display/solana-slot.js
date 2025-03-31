const i2c = require("i2c-bus");
const Oled = require("oled-i2c-bus");
const font = require("oled-font-5x7");
const { Connection } = require("@solana/web3.js");

const opts = {
  width: 128,
  height: 32,
  address: 0x3c,
};

const i2cBus = i2c.openSync(1);
const oled = new Oled(i2cBus, opts);

// Clear and activate display
oled.clearDisplay();
oled.turnOnDisplay();

// Your websocket connection may not be working with the public end points.
// Thats why there is some additional polling in the code in animate() that you can remove later
// if you have a payed RPC URL.
// Initialize Solana connection
const connection = new Connection(
  "https://api.mainnet-beta.solana.com",
  "processed"
);
// Or use devnet:
// const connection = new Connection('https://api.devnet.solana.com', 'processed');
let currentSlot = 0;

function drawSolanaLogo(x, y, size) {
  // Draw three horizontal lines with 2px thickness

  // Top line
  oled.drawLine(
    1 + x - size / 2,
    y - size / 2,
    1 + x + size / 2,
    y - size / 2,
    1
  );
  oled.drawLine(
    x - size / 2,
    y - size / 2 + 1,
    x + size / 2,
    y - size / 2 + 1,
    1
  );

  // Middle line
  oled.drawLine(x - size / 2, y, x + size / 2, y, 1);
  oled.drawLine(1 + x - size / 2, y + 1, 1 + x + size / 2, y + 1, 1);

  // Bottom line
  oled.drawLine(
    1 + x - size / 2,
    y + size / 2,
    1 + x + size / 2,
    y + size / 2,
    1
  );
  oled.drawLine(
    x - size / 2,
    y + size / 2 + 1,
    x + size / 2,
    y + size / 2 + 1,
    1
  );
}

function animate() {
  // This is not necessary if your websocket connection is working.
  // Just with the public end points its not always reliable so i added this polling here as well.
  // Feel free to remove if you have a proper RPC url.
  getSlot();

  // Clear display
  oled.clearDisplay();

  // Draw Solana logos on sides
  drawSolanaLogo(15, opts.height / 2, 6); // Left logo
  drawSolanaLogo(opts.width - 15, opts.height / 2, 6); // Right logo

  // Draw "SLOT" text
  const labelX = (opts.width - 30) / 2;
  oled.setCursor(labelX, 5);
  oled.writeString(font, 1, "SLOT", 1, true);

  // Draw slot number below
  const slotText = `${currentSlot}`;
  const slotX = (opts.width - slotText.length * 6) / 2;
  oled.setCursor(slotX, 20);
  oled.writeString(font, 1, slotText, 1, true);
}

// Subscribe to slot updates
const slotSubscription = connection.onSlotChange((slotInfo) => {
  currentSlot = slotInfo.slot;
  console.log("New slot:", currentSlot);

  animate();

  // Quick flash effect for new slot
  // oled.invertDisplay(true);
  // setTimeout(() => {
  //     oled.invertDisplay(false);
  // }, 100);
});

// Handle cleanup on exit
process.on("SIGINT", () => {
  if (slotSubscription) {
    connection.removeSlotChangeListener(slotSubscription);
  }
  oled.clearDisplay();
  oled.turnOffDisplay();
  process.exit();
});

// Start animation loop. Can add some nice animations here.
setInterval(animate, 20);

function getSlot() {
  // Get initial slot
  connection.getSlot().then((slot) => {
    currentSlot = slot;
    console.log("Initial slot:", currentSlot);
  });
}

getSlot();
