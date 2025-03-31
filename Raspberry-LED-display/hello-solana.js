const i2c = require("i2c-bus");
const Oled = require("oled-i2c-bus");
const font = require("oled-font-5x7");

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

// Animation variables
let rotationAngle = 0;
let textY = opts.height;
let textDirection = -1;

function drawSolLogo(x, y, size, angle) {
  const points = [];
  // Generate hexagon points
  for (let i = 0; i < 6; i++) {
    const pointAngle = angle + i * 60;
    const px = x + size * Math.cos((pointAngle * Math.PI) / 180);
    const py = y + size * Math.sin((pointAngle * Math.PI) / 180);
    points.push([Math.round(px), Math.round(py)]);
  }

  // Draw hexagon
  for (let i = 0; i < points.length; i++) {
    const start = points[i];
    const end = points[(i + 1) % points.length];
    oled.drawLine(start[0], start[1], end[0], end[1], 1);
  }

  // Draw center dot
  oled.drawPixel([
    [x, y],
    [x + 1, y],
    [x - 1, y],
    [x, y + 1],
    [x, y - 1],
  ]);
}

function drawCirclePattern(centerX, centerY) {
  // Draw left circle
  for (let i = 0; i < 360; i += 45) {
    const x1 = Math.round(centerX - 50 + 3 * Math.cos((i * Math.PI) / 180));
    const y1 = Math.round(centerY + 3 * Math.sin((i * Math.PI) / 180));
    const x2 = Math.round(
      centerX - 50 + 3 * Math.cos(((i + 45) * Math.PI) / 180)
    );
    const y2 = Math.round(centerY + 3 * Math.sin(((i + 45) * Math.PI) / 180));
    oled.drawLine(x1, y1, x2, y2, 1);
  }

  // Draw right circle
  for (let i = 0; i < 360; i += 45) {
    const x1 = Math.round(centerX + 50 + 3 * Math.cos((i * Math.PI) / 180));
    const y1 = Math.round(centerY + 3 * Math.sin((i * Math.PI) / 180));
    const x2 = Math.round(
      centerX + 50 + 3 * Math.cos(((i + 45) * Math.PI) / 180)
    );
    const y2 = Math.round(centerY + 3 * Math.sin(((i + 45) * Math.PI) / 180));
    oled.drawLine(x1, y1, x2, y2, 1);
  }
}

function animate() {
  // Clear display
  oled.clearDisplay();

  // Draw Solana logos on sides
  drawSolLogo(15, opts.height / 2, 6, rotationAngle);
  drawSolLogo(opts.width - 15, opts.height / 2, 6, -rotationAngle);

  // Draw circle pattern in center
  drawCirclePattern(opts.width / 2, opts.height / 2);

  // Draw text
  const text = "Hello Solana!";
  const textX = 27;
  oled.setCursor(textX, textY);
  oled.writeString(font, 1, text, 1, true);

  // Update animation variables
  textY += textDirection * 2;

  if (textY <= 0) {
    textDirection = 1;
  } else if (textY >= opts.height) {
    textDirection = -1;
  }

  rotationAngle = (rotationAngle + 6) % 360;
}

// Handle cleanup on exit
process.on("SIGINT", () => {
  oled.clearDisplay();
  oled.turnOffDisplay();
  process.exit();
});

// Start animation loop with faster interval
setInterval(animate, 30);
