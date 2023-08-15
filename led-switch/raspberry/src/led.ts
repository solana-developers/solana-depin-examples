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
