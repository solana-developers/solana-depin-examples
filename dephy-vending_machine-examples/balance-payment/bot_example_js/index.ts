import * as anchor from "@coral-xyz/anchor";
import * as ed from "@noble/ed25519";
import { web3, Program, BN } from "@coral-xyz/anchor";
import { BalancePayment } from "./balance_payment";
import BalancePaymentIDL from "./balance_payment.json";
import { Command } from "commander";
import { v4 as uuidv4 } from "uuid";
import {
  Connection,
  Keypair,
  SendTransactionError,
  TransactionExpiredTimeoutError,
} from "@solana/web3.js";
import keccak from "keccak";
import { readFileSync } from "fs";
import os from "os";
import path from "path";
import bs58 from "bs58";

const cli = new Command();

const initializeProviderAndProgram = (
  net: string,
  rpc?: string,
  keypairPath?: string
) => {
  if (net !== "devnet" && net !== "mainnet-beta") {
    throw new Error("net must be devnet or mainnet-beta");
  }

  const rpcEndpoint = rpc ?? web3.clusterApiUrl(net);
  const connection = new web3.Connection(rpcEndpoint, "confirmed");

  let provider: anchor.Provider;
  let keypair: web3.Keypair | null = null;

  if (keypairPath) {
    keypair = getKeypair(keypairPath);
    const wallet = new anchor.Wallet(keypair);
    provider = new anchor.AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
  } else {
    provider = new anchor.AnchorProvider(connection, {} as anchor.Wallet, {
      commitment: "confirmed",
    });
  }

  anchor.setProvider(provider);

  const program = new Program(
    {
      ...BalancePaymentIDL,
      address: BalancePaymentIDL.address,
    } as BalancePayment,
    provider
  );

  return {
    keypair, // 如果没有 keypairPath，这里会返回 null
    provider,
    program,
  };
};

type Methods = anchor.Program<BalancePayment>["methods"];

const execute = async (tx: ReturnType<Methods[keyof Methods]>) => {
  const pubkeys = await tx.pubkeys();
  for (const [name, key] of Object.entries(pubkeys)) {
    console.log(name, key.toBase58());
  }
  const signature = await tx.rpc();
  console.log("signature", signature);
  return { signature, pubkeys };
};

const sol = (n: number | string) => {
  return new BN(Number(n) * web3.LAMPORTS_PER_SOL);
};

const generate64ByteUUIDPayload = (): Buffer => {
  const uuid = uuidv4().replace(/-/g, "");
  const uuidBuffer = Buffer.from(uuid, "hex");
  const extendedBuffer = Buffer.concat([uuidBuffer, Buffer.alloc(48, 0)]);
  return extendedBuffer;
};

const getKeypair = (keypairPath?: string): Keypair => {
  // Default path: ~/.config/solana/id.json
  const defaultPath = path.join(os.homedir(), ".config", "solana", "id.json");
  const resolvedPath = keypairPath || defaultPath;

  try {
    const keypairFile = readFileSync(resolvedPath, "utf-8");
    const keypair = Keypair.fromSecretKey(Buffer.from(JSON.parse(keypairFile)));
    return keypair;
  } catch (error) {
    throw new Error(
      `Failed to load keypair from ${resolvedPath}: ${error.message}`
    );
  }
};

const getUserAccountPubkey = (user: web3.PublicKey) => {
  const [userAccountPubkey, _] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("USER"), user.toBuffer()],
    new web3.PublicKey(BalancePaymentIDL.address)
  );
  return userAccountPubkey;
};

async function confirmTransaction(connection, txHash) {
  const maxRetries = 10;
  const retryInterval = 3000;

  for (let i = 0; i < maxRetries; i++) {
    const status = await connection.getSignatureStatus(txHash);
    if (
      status &&
      status.value &&
      status.value.confirmationStatus === "finalized"
    ) {
      return "finalized";
    }
    console.log(
      `Transaction not finalized yet. Retrying in ${
        retryInterval / 1000
      } seconds...`
    );
    await sleep(retryInterval);
  }

  return "failed";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const SUCCESS = 0;
const NETWORK_ERROR = 1;
const PARAMS_ERROR = 11;
const TRANSACTION_SEND_ERROR = 101;
const TRANSACTION_NOT_CONFIRMED = 102;
const TRANSACTION_UNKNOWN_ERROR = 103;

const SIGN_MESSAGE_PREFIX = "DePHY vending machine/Example:\n";

cli.name("cli");

cli
  .command("sign_message")
  .requiredOption("--net <net>", "devnet | mainnet-beta")
  .option("--rpc <rpc>", "rpc url link")
  .requiredOption(
    "--keypair <keypair>",
    "Path to keypair file (default: ~/.config/solana/id.json)"
  )
  .requiredOption("--minutes <minutes>", "Minutes until deadline")
  .action(async (opt) => {
    const { keypair: userKeypair, program } = initializeProviderAndProgram(
      opt.net,
      opt.rpc,
      opt.keypair
    );

    const user = userKeypair.publicKey; // Use the public key from the provided keypair

    // Log the user who is signing
    console.log("Signing user:", user.toBase58());

    // Get nonce from user account
    const userAccountPubkey = getUserAccountPubkey(user);
    const userAccount = await program.account.userAccount.fetch(
      userAccountPubkey
    );

    console.log("Signing nonce:", userAccount.nonce.toNumber());

    // Convert minutes to deadline (current timestamp + minutes * 60 seconds)
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const deadline = new BN(currentTimestamp + Number(opt.minutes) * 60);

    // Generate payload
    const payload = generate64ByteUUIDPayload();

    // Create message
    const message = Buffer.concat([
      payload,
      userAccount.nonce.toArrayLike(Buffer, "le", 8),
      deadline.toArrayLike(Buffer, "le", 8),
    ]);

    // Hash the message and generate digest
    const messageHash = keccak("keccak256").update(message).digest();
    const hashedMessageBase58 = bs58.encode(messageHash);
    const digest = new TextEncoder().encode(
      `${SIGN_MESSAGE_PREFIX}${hashedMessageBase58}`
    );

    // Get user's private key
    const privateKey = userKeypair.secretKey.slice(0, 32); // First 32 bytes are the private key

    // Sign the message
    const signature = await ed.signAsync(digest, privateKey);

    // Create recoverInfo
    const recoverInfo = {
      signature: Array.from(signature),
      payload: Array.from(payload),
      deadline,
    };

    // Output recoverInfo as JSON
    const jsonString = JSON.stringify(recoverInfo);
    console.log("Recover Info (JSON):", jsonString);

    const base64String = Buffer.from(jsonString).toString("base64");
    console.log("Recover Info (Base64):", base64String);
  });

cli
  .command("check_eligible")
  .requiredOption("--net <net>", "devnet | mainnet-beta")
  .option("--rpc <rpc>", "rpc url link")
  .requiredOption("--user <user>", "User Pubkey")
  .requiredOption("--nonce <nonce>", "Nonce from request paylaod")
  .requiredOption("--amount <amount>", "Amount in SOL")
  .requiredOption("--recoverInfo <recoverInfo>", "Recover Info (Base64)")
  .action(async (opt) => {
    const check = async (opt) => {
      try {
        const lockAmount = sol(opt.amount);
        const recoverInfo = JSON.parse(
          Buffer.from(opt.recoverInfo, "base64").toString()
        );
        const userPubkey = new web3.PublicKey(opt.user);

        const { program, provider } = initializeProviderAndProgram(
          opt.net,
          opt.rpc,
          opt.keypair
        );

        const userAccountPubkey = getUserAccountPubkey(userPubkey);

        const userAccount = await program.account.userAccount.fetch(
          userAccountPubkey
        );

        // 0.check nonce from request payload whether equal to nonce on chain
        if (userAccount.nonce.toNumber() !== parseInt(opt.nonce, 10)) {
          return false;
        }

        // 1.concat message, nonce is from blockchain
        const message = Buffer.concat([
          Buffer.from(recoverInfo.payload),
          userAccount.nonce.toArrayLike(Buffer, "le", 8),
          new BN(recoverInfo.deadline, "hex").toArrayLike(Buffer, "le", 8),
        ]);

        // 2.hash message and generate digest
        const messageHash = keccak("keccak256").update(message).digest();
        const hashedMessageBase58 = bs58.encode(messageHash);
        const digest = new TextEncoder().encode(
          `${SIGN_MESSAGE_PREFIX}${hashedMessageBase58}`
        );

        // 3.verify signature source
        const isValid = await ed.verifyAsync(
          Buffer.from(recoverInfo.signature),
          digest,
          userPubkey.toBytes()
        );
        if (!isValid) {
          return false;
        }

        // 4.verify deadline expiration
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const deadlineTimestamp = new BN(
          recoverInfo.deadline,
          "hex"
        ).toNumber();
        if (currentTimestamp >= deadlineTimestamp) {
          return false;
        }

        // 5.verify available balance
        const userVaultBalance = new BN(
          await provider.connection.getBalance(userAccount.vault)
        );
        const availableBalance = userVaultBalance.sub(userAccount.lockedAmount);
        if (availableBalance.lt(lockAmount)) {
          return false;
        }

        return true;
      } catch (e) {
        console.error("check eligibility error happened,", e);
        return false;
      }
    };
    const result = await check(opt);
    console.log(result);
    process.exit(result ? 0 : 1);
  });

cli
  .command("lock")
  .requiredOption("--net <net>", "devnet | mainnet-beta")
  .option("--rpc <rpc>", "rpc url link")
  .requiredOption(
    "--keypair <keypair>",
    "Path to keypair file (default: ~/.config/solana/id.json)"
  )
  .requiredOption("--user <user>", "User Pubkey")
  .requiredOption("--amount <amount>", "Amount in SOL")
  .requiredOption("--recoverInfo <recoverInfo>", "Recover Info (Base64)")
  .action(async (opt) => {
    const { program } = initializeProviderAndProgram(
      opt.net,
      opt.rpc,
      opt.keypair
    );

    let user: web3.PublicKey, nonce: BN, amount: BN, recoverInfo: any;
    try {
      user = new web3.PublicKey(opt.user);
      nonce = new BN(opt.nonce);
      amount = sol(opt.amount);
      recoverInfo = JSON.parse(
        Buffer.from(opt.recoverInfo, "base64").toString()
      );
    } catch (error) {
      console.error("Parameter parsing error:", error);
      process.exit(PARAMS_ERROR); // 参数解析错误
    }

    // 处理 recoverInfo
    try {
      recoverInfo.signature = Array.from(recoverInfo.signature);
      recoverInfo.payload = Array.from(recoverInfo.payload);
      recoverInfo.deadline = new BN(recoverInfo.deadline, "hex");
    } catch (error) {
      console.error("RecoverInfo parsing error:", error);
      process.exit(PARAMS_ERROR); // 参数解析错误
    }

    const [globalAccountPubkey] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("GLOBAL")],
      program.programId
    );
    let globalAccount: any;
    try {
      globalAccount = await program.account.globalAccount.fetch(
        globalAccountPubkey
      );
    } catch (error) {
      console.error("Failed to fetch global account:", error);
      process.exit(NETWORK_ERROR); // 网络或账户获取错误
    }

    const tx = program.methods.lock(recoverInfo, amount).accountsPartial({
      user,
      bot: globalAccount.bot,
    });

    try {
      await execute(tx);
      console.log("Lock transaction completed successfully.");
    } catch (error) {
      if (error instanceof SendTransactionError) {
        console.error("Smart contract reverted:", error);
        process.exit(TRANSACTION_SEND_ERROR); // 交易发送失败
      } else if (error instanceof TransactionExpiredTimeoutError) {
        const txHash = error.signature;
        console.log(
          `Transaction expired but may have succeeded. Checking status for tx hash: ${txHash}`
        );

        const connection = new Connection(
          opt.rpc || "https://api.devnet.solana.com"
        );
        const status = await confirmTransaction(connection, txHash);

        if (status === "finalized") {
          console.log("Transaction finalized successfully.");
        } else {
          console.error("Transaction failed or could not be finalized.");
          process.exit(TRANSACTION_NOT_CONFIRMED);
        }
      } else {
        console.error("Error during lock transaction:", error);
        process.exit(TRANSACTION_UNKNOWN_ERROR);
      }
    }

    process.exit(SUCCESS);
  });

cli
  .command("settle")
  .requiredOption("--net <net>", "devnet | mainnet-beta")
  .option("--rpc <rpc>", "rpc url link")
  .requiredOption(
    "--keypair <keypair>",
    "Path to keypair file (default: ~/.config/solana/id.json)"
  )
  .requiredOption("--user <user>", "User Pubkey")
  .requiredOption("--nonce <nonce>", "Nonce")
  .requiredOption("--amountToTransfer <amountToTransfer>", "Amount in SOL")
  .action(async (opt) => {
    const { program } = initializeProviderAndProgram(
      opt.net,
      opt.rpc,
      opt.keypair
    );

    let user: web3.PublicKey, nonce: BN, amountToTransfer: BN;
    try {
      user = new web3.PublicKey(opt.user);
      nonce = new BN(opt.nonce);
      amountToTransfer = sol(opt.amountToTransfer);
    } catch (error) {
      console.error("Parameter parsing error:", error);
      process.exit(PARAMS_ERROR);
    }

    let globalAccountPubkey: web3.PublicKey, globalAccount: any;
    try {
      [globalAccountPubkey] = web3.PublicKey.findProgramAddressSync(
        [Buffer.from("GLOBAL")],
        program.programId
      );
      globalAccount = await program.account.globalAccount.fetch(
        globalAccountPubkey
      );
    } catch (error) {
      console.error("Failed to fetch global account:", error);
      process.exit(NETWORK_ERROR);
    }

    let userAccountPubkey: web3.PublicKey, userAccount: any;
    try {
      userAccountPubkey = getUserAccountPubkey(userAccountPubkey);
      userAccount = await program.account.userAccount.fetch(userAccountPubkey);
    } catch (error) {
      console.error("Failed to fetch user account:", error);
      process.exit(NETWORK_ERROR);
    }

    if (nonce.gte(userAccount.nonce)) {
      console.error(
        `nonce too large: ${nonce.toNumber()} >= ${userAccount.nonce.toNumber()}}`
      );
      process.exit(PARAMS_ERROR);
    }

    const [lockAccountPubkey] = web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("LOCK"),
        user.toBuffer(),
        nonce.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );
    try {
      await program.account.lockAccount.fetch(lockAccountPubkey);
    } catch (error) {
      if (
        error.message.includes("Account does not exist") &&
        nonce.lt(userAccount.nonce)
      ) {
        console.log("Lock already been settled");
        process.exit(SUCCESS);
      } else {
        console.error("Fetch lock account error:", error);
        process.exit(NETWORK_ERROR);
      }
    }

    const tx = program.methods.settle(nonce, amountToTransfer).accountsPartial({
      user,
      treasury: globalAccount.treasury,
      bot: globalAccount.bot,
    });

    try {
      await execute(tx);
      console.log("Settle transaction completed successfully.");
    } catch (error) {
      if (error instanceof SendTransactionError) {
        console.error("Smart contract reverted:", error);
        process.exit(TRANSACTION_SEND_ERROR);
      } else if (error instanceof TransactionExpiredTimeoutError) {
        const txHash = error.signature;
        console.log(
          `Transaction expired but may have succeeded. Checking status for tx hash: ${txHash}`
        );

        const connection = new Connection(
          opt.rpc || "https://api.devnet.solana.com"
        );
        const status = await confirmTransaction(connection, txHash);

        if (status === "finalized") {
          console.log("Transaction finalized successfully.");
        } else {
          console.error("Transaction failed or could not be finalized.");
          process.exit(TRANSACTION_NOT_CONFIRMED); // 返回非零退出码表示失败
        }
      } else {
        console.error("Error during settle transaction:", error);
        process.exit(TRANSACTION_UNKNOWN_ERROR); // 返回非零退出码表示失败
      }
    }

    process.exit(SUCCESS);
  });

cli
  .command("pay")
  .requiredOption("--net <net>", "devnet | mainnet-beta")
  .option("--rpc <rpc>", "rpc url link")
  .requiredOption(
    "--keypair <keypair>",
    "Path to keypair file (default: ~/.config/solana/id.json)"
  )
  .requiredOption("--user <user>", "User Pubkey")
  .requiredOption("--amountToTransfer <amountToTransfer>", "Amount in SOL")
  .requiredOption("--recoverInfo <recoverInfo>", "Recover Info (Base64)")
  .action(async (opt) => {
    const { program } = initializeProviderAndProgram(
      opt.net,
      opt.rpc,
      opt.keypair
    );

    let user: web3.PublicKey, nonce: BN, amountToTransfer: BN, recoverInfo: any;
    try {
      user = new web3.PublicKey(opt.user);
      nonce = new BN(opt.nonce);
      amountToTransfer = sol(opt.amountToTransfer);
      recoverInfo = JSON.parse(
        Buffer.from(opt.recoverInfo, "base64").toString()
      );
    } catch (error) {
      console.error("Parameter parsing error:", error);
      process.exit(PARAMS_ERROR); // 参数解析错误
    }

    // 处理 recoverInfo
    try {
      recoverInfo.signature = Array.from(recoverInfo.signature);
      recoverInfo.payload = Array.from(recoverInfo.payload);
      recoverInfo.deadline = new BN(recoverInfo.deadline, "hex");
    } catch (error) {
      console.error("RecoverInfo parsing error:", error);
      process.exit(PARAMS_ERROR); // 参数解析错误
    }

    const [globalAccountPubkey] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("GLOBAL")],
      program.programId
    );
    let globalAccount: any;
    try {
      globalAccount = await program.account.globalAccount.fetch(
        globalAccountPubkey
      );
    } catch (error) {
      console.error("Failed to fetch global account:", error);
      process.exit(NETWORK_ERROR); // 网络或账户获取错误
    }

    const tx = program.methods.pay(recoverInfo, amountToTransfer).accountsPartial({
      user,
      treasury: globalAccount.treasury,
      bot: globalAccount.bot,
    });

    try {
      await execute(tx);
      console.log("Pay transaction completed successfully.");
    } catch (error) {
      if (error instanceof SendTransactionError) {
        console.error("Smart contract reverted:", error);
        process.exit(TRANSACTION_SEND_ERROR); // 交易发送失败
      } else if (error instanceof TransactionExpiredTimeoutError) {
        const txHash = error.signature;
        console.log(
          `Transaction expired but may have succeeded. Checking status for tx hash: ${txHash}`
        );

        const connection = new Connection(
          opt.rpc || "https://api.devnet.solana.com"
        );
        const status = await confirmTransaction(connection, txHash);

        if (status === "finalized") {
          console.log("Transaction finalized successfully.");
        } else {
          console.error("Transaction failed or could not be finalized.");
          process.exit(TRANSACTION_NOT_CONFIRMED);
        }
      } else {
        console.error("Error during lock transaction:", error);
        process.exit(TRANSACTION_UNKNOWN_ERROR);
      }
    }

    process.exit(SUCCESS);
  });

cli.parse();
