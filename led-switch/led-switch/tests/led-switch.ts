import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { LedSwitch } from "../target/types/led_switch";
import { assert } from "chai";

describe("led-switch", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.LedSwitch as Program<LedSwitch>;
  const wallet = anchor.workspace.LedSwitch.provider.wallet

  it("Is initialized!", async () => {
    
    const ledSwitchPDA = await anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("led-switch"),
      ],
      program.programId,
    )[0];
    console.log("Led switch pda", ledSwitchPDA);
    try {
      const tx = await program.methods.initialize().accounts(
        {
          ledSwitch: ledSwitchPDA,
          authority: wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
      ).rpc();
      console.log("Your transaction signature", tx);
    } catch (e) {
      console.log(e);
    }

    const tx2 = await program.methods.switch(true).accounts(
      {
        ledSwitch: ledSwitchPDA,
        authority: wallet.publicKey
      },
    ).rpc();

    const gameDataAccount = await program.account.ledSwitch.fetch(
      ledSwitchPDA
    )

    assert(gameDataAccount.isOn === true, "Game data account is not initialized correctly")

    console.log("Your transaction signature", tx2);
  });
});
