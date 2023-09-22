import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { IDL, LorawanChest } from "./lorawan_chest";
import { clusterApiUrl, Connection, Keypair } from "@solana/web3.js";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";

var Gpio = require('onoff').Gpio; //include onoff to interact with the GPIO
var LED = new Gpio(18, 'out'); //use GPIO pin 18, and specify that it is output

let connection = new Connection(clusterApiUrl("devnet"));
let wallet = new NodeWallet(new Keypair());
const provider = new anchor.AnchorProvider(connection, wallet, {
  commitment: "processed",
});
anchor.setProvider(provider);

const program = new Program<LorawanChest>(IDL, "2UYaB7aU7ZPA5LEQh3ZtWzC1MqgLkEJ3nBKebGUrFU3f", { connection })

console.log("Program ID", program.programId.toString());

startListeningToLedSwitchAccount();

async function startListeningToLedSwitchAccount() {
    const ledSwitchPDA = await anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("lorawan_chest"),
        ],
        program.programId,
      )[0];

    const ledSwitchAccount = await program.account.lorawanChest.fetch(
        ledSwitchPDA
    )

    console.log(JSON.stringify(ledSwitchAccount));
    console.log("Chest is: ", ledSwitchAccount.isOpen);

    if (ledSwitchAccount.isOpen) {
      LED.writeSync(1);
    } else {
      LED.writeSync(0);
    }
    
    connection.onAccountChange(ledSwitchPDA, (account) => {
        const decoded = program.coder.accounts.decode(
            "lorawanChest",
            account.data
          )

          if (decoded.isOn) {
            LED.writeSync(1);
          } else {
            LED.writeSync(0);
          }
        console.log("Account changed. Chest is: ", decoded.isOpen);
    }, "processed")
};
