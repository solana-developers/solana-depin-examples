import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { LorawanChest } from "../target/types/lorawan_chest";
import { assert } from "chai";

describe("lorawan-chest-test", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.LorawanChest as Program<LorawanChest>;
  const wallet = anchor.workspace.LorawanChest.provider.wallet

  it("Is initialized!", async () => {
    
    const lorawanChestPDA = await anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("lorawan_chest"),
      ],
      program.programId,
    )[0];
    
    console.log("Lorawan Chest pda", lorawanChestPDA);

    try {
      const initializeTransaction = await program.methods.initialize().accounts(
        {
          lorawanChest: lorawanChestPDA,
          authority: wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
      ).rpc();
      console.log("Initialize transaction signature: ", initializeTransaction);
    } catch (e) {
      console.log(e);
    }

    const switchOnTransaction = await program.methods.switch(true).accounts(
      {
        lorawanChest: lorawanChestPDA,
        authority: wallet.publicKey
      },
    ).rpc();

    const ledAccount = await program.account.lorawanChest.fetch(
      lorawanChestPDA
    )
    console.log("Your switch on transaction signature", switchOnTransaction);

    assert(ledAccount.isOpen === true, "Chest account is not initialized correctly. Should be open/true")
  });
});
