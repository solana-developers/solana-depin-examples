import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolanaBar } from "../target/types/solana_bar";
import { assert } from "chai";
import { PublicKey } from "@solana/web3.js";

describe("SolanaBar", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.SolanaBar as Program<SolanaBar>;
  const wallet = anchor.workspace.SolanaBar.provider.wallet

  it("Is initialized!", async () => {
    
    const receiptsPDA = await anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("receipts"),
      ],
      program.programId,
    )[0];
    
    console.log("Receipts", receiptsPDA);

    try {
      const initializeTransaction = await program.methods.initialize().accounts(
        {
          receipts: receiptsPDA,
          authority: wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
      ).rpc();
      console.log("Initialize transaction signature: ", initializeTransaction);
    } catch (e) {
      console.log(e);
    }

    const switchOnTransaction = await program.methods.buyShot().accounts(
      {
        receipts: receiptsPDA,
        signer: wallet.publicKey,
        treasury: new PublicKey("GsfNSuZFrT2r4xzSndnCSs9tTXwt47etPqU8yFVnDcXd"),
        systemProgram: anchor.web3.SystemProgram.programId,
      },
    ).rpc();

    const ledAccount = await program.account.receipts.fetch(
      receiptsPDA
    )
    console.log("Your switch on transaction signature", switchOnTransaction);

    assert(ledAccount.receipts.length === 0, "Game data account is not initialized correctly. Should be on/true")
  });
});
