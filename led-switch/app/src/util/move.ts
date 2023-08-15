import { TransactionInstruction, SystemProgram, PublicKey, Connection, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import * as borsh from "borsh";
import { Buffer } from "buffer";
import { LED_SWITCH_PDA, LED_SWITCH_PROGRAM_ID } from "./const";
var sha256 = require('sha256')

export const createSwitchOnInstruction = async (
    payer: PublicKey,
) => {
    const anchorFunctionDescriminator = sha256("global:pull_right")

    return new TransactionInstruction({
        keys: [
            { pubkey: LED_SWITCH_PDA, isSigner: false, isWritable: true },
            { pubkey: payer, isSigner: true, isWritable: true },
        ],
        programId: LED_SWITCH_PROGRAM_ID,
        data: Buffer.from(anchorFunctionDescriminator.toString().substring(0, 16), "hex")
    })
};
