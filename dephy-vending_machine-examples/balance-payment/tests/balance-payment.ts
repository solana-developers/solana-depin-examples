import * as anchor from "@coral-xyz/anchor";
import { BN, Program, web3 } from "@coral-xyz/anchor";
import { v4 as uuidv4 } from "uuid";
import { BalancePayment } from "../target/types/balance_payment";
import { assert } from "chai";
import keccak from "keccak";
import * as ed from "@noble/ed25519";
import bs58 from 'bs58';

const SIGN_MESSAGE_PREFIX = "DePHY vending machine/Example:\n";

const sol = function (n: number) {
  return new BN(n * web3.LAMPORTS_PER_SOL);
};

describe("balance-payment", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.BalancePayment as Program<BalancePayment>;

  const authority = web3.Keypair.generate();
  const treasury = web3.Keypair.generate();
  const bot = web3.Keypair.generate();

  const user = web3.Keypair.generate();

  const [globalAccountPubkey, _] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("GLOBAL")],
    anchor.workspace.BalancePayment.programId
  );

  const getUserAccountPubkey = (user: web3.PublicKey) => {
    const [userAccountPubkey, _] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("USER"), user.toBuffer()],
      anchor.workspace.BalancePayment.programId
    );
    return userAccountPubkey;
  };

  const getUserVaultPubkey = (user: web3.PublicKey) => {
    const [vaultPubkey, _] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("VAULT"), user.toBuffer()],
      anchor.workspace.BalancePayment.programId
    );
    return vaultPubkey;
  };

  const getLockAccountPubkey = (user: web3.PublicKey, nonce: BN) => {
    const [lockAccountPubkey, _] = web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("LOCK"),
        user.toBuffer(),
        nonce.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );
    return lockAccountPubkey;
  };

  const generate64ByteUUIDPayload = (): Buffer => {
    const uuid = uuidv4().replace(/-/g, ""); // 去掉连字符
    const uuidBuffer = Buffer.from(uuid, "hex");

    const extendedBuffer = Buffer.concat([uuidBuffer, Buffer.alloc(48, 0)]);

    return extendedBuffer;
  };
  const airdrop = async (to: web3.PublicKey, amount: BN) => {
    await anchor.Native.system()
      .methods.transfer(amount)
      .accounts({ to })
      .rpc();
  };

  before(async () => {
    await airdrop(user.publicKey, sol(100));
  });

  it("initialize", async () => {
    const tempTreasury = web3.Keypair.generate().publicKey;
    const tempBot = web3.Keypair.generate().publicKey;
    const { signature } = await program.methods
      .initialize()
      .accountsPartial({
        authority: authority.publicKey,
        treasury: tempTreasury,
        bot: tempBot,
      })
      .rpcAndKeys();
    console.log("initialize:", signature);

    const global = await program.account.globalAccount.fetch(
      globalAccountPubkey
    );
    assert.equal(global.authority.toString(), authority.publicKey.toString());
    assert.equal(global.treasury.toString(), tempTreasury.toString());
    assert.equal(global.bot.toString(), tempBot.toString());
  });

  it("set treasury", async () => {
    const { signature } = await program.methods
      .setTreasury()
      .accountsPartial({
        authority: authority.publicKey,
        treasury: treasury.publicKey,
      })
      .signers([authority])
      .rpcAndKeys();
    console.log("set_treasury:", signature);

    const global = await program.account.globalAccount.fetch(
      globalAccountPubkey
    );
    assert.equal(global.treasury.toString(), treasury.publicKey.toString());
  });

  it("set bot", async () => {
    const { signature } = await program.methods
      .setBot()
      .accountsPartial({
        authority: authority.publicKey,
        bot: bot.publicKey,
      })
      .signers([authority])
      .rpcAndKeys();
    console.log("set_bot:", signature);

    const global = await program.account.globalAccount.fetch(
      globalAccountPubkey
    );
    assert.equal(global.bot.toString(), bot.publicKey.toString());
  });

  it("register", async () => {
    const { signature } = await program.methods
      .register()
      .accountsPartial({
        user: user.publicKey,
      })
      .signers([user])
      .rpcAndKeys();
    console.log("register:", signature);

    const userAccountPubkey = getUserAccountPubkey(user.publicKey);
    const userAccount = await program.account.userAccount.fetch(
      userAccountPubkey
    );
    assert.equal(
      userAccount.vault.toString(),
      getUserVaultPubkey(user.publicKey).toString()
    );
  });

  it("deposit", async () => {
    const amount = sol(11);

    const { signature } = await program.methods
      .deposit(amount)
      .accountsPartial({
        user: user.publicKey,
      })
      .signers([user])
      .rpcAndKeys();
    console.log("deposit:", signature);

    const userVaultPubkey = getUserVaultPubkey(user.publicKey);
    const userVaultBalance = await program.provider.connection.getBalance(
      userVaultPubkey
    );

    assert(amount.eq(new BN(userVaultBalance)));
  });

  it("withdraw", async () => {
    const amount = sol(1);

    const { signature } = await program.methods
      .withdraw(amount)
      .accountsPartial({
        user: user.publicKey,
      })
      .signers([user])
      .rpcAndKeys();
    console.log("withdraw:", signature);

    const userVaultPubkey = getUserVaultPubkey(user.publicKey);
    const userVaultBalance = await program.provider.connection.getBalance(
      userVaultPubkey
    );

    assert(sol(10).eq(new BN(userVaultBalance)));
  });

  it("lock", async () => {
    const amount = sol(10);

    const userAccountPubkey = getUserAccountPubkey(user.publicKey);

    let userAccount = await program.account.userAccount.fetch(
      userAccountPubkey
    );

    const nonce = userAccount.nonce;
    const payload = generate64ByteUUIDPayload();

    const deadline = new BN(Date.now() / 1000 + 60 * 30); // 30 minutes later
    const message = Buffer.concat([
      payload,
      nonce.toArrayLike(Buffer, "le", 8),
      deadline.toArrayLike(Buffer, "le", 8),
    ]);

    const messageHash = keccak("keccak256").update(message).digest();
    const hashedMessageBase58 = bs58.encode(messageHash);
    const digest =  new TextEncoder().encode(`${SIGN_MESSAGE_PREFIX}${hashedMessageBase58}`);

    const privateKey = user.secretKey.slice(0, 32);

    const signature = await ed.signAsync(digest, privateKey);

    const recoverInfo = {
      signature: Array.from(signature),
      payload: Array.from(payload),
      deadline,
    };

    const { signature: txSignature } = await program.methods
    .lock(recoverInfo, amount)
    .accountsPartial({
      user: user.publicKey,
      bot: bot.publicKey,
    })
    .signers([bot])
    .rpcAndKeys();

    console.log("lock:", txSignature);

    const lockAccountPubkey = getLockAccountPubkey(user.publicKey, nonce);
    const lockAccount = await program.account.lockAccount.fetch(
      lockAccountPubkey
    );
    assert.equal(lockAccount.amount.toString(), amount.toString());

    userAccount = await program.account.userAccount.fetch(userAccountPubkey);
    assert(userAccount.lockedAmount.eq(amount));
  });

  it("settle", async () => {
    const nonce = new BN(0);
    const amountToTransfer = sol(5);

    const { signature } = await program.methods
      .settle(nonce, amountToTransfer)
      .accountsPartial({
        user: user.publicKey,
        treasury: treasury.publicKey,
        bot: bot.publicKey,
      })
      .signers([bot])
      .rpcAndKeys();

    console.log("settle:", signature);

    const treasuryBalance = await program.provider.connection.getBalance(
      treasury.publicKey
    );
    assert.equal(treasuryBalance, amountToTransfer.toNumber());

    const lockAccountPubkey = getLockAccountPubkey(user.publicKey, nonce);

    try {
      await program.account.lockAccount.fetch(
        lockAccountPubkey
      );
    } catch (error) {
      assert(error.message.includes("Account does not exist"))
    }

    const userAccountPubkey = getUserAccountPubkey(user.publicKey);
    const userAccount = await program.account.userAccount.fetch(
      userAccountPubkey
    );
    assert(userAccount.lockedAmount.eq(new BN(0)));
  });

  it("pay", async () => {
    const amountToTransfer = sol(1);

    const userAccountPubkey = getUserAccountPubkey(user.publicKey);

    let userAccount = await program.account.userAccount.fetch(
      userAccountPubkey
    );

    const nonce = userAccount.nonce;
    const payload = generate64ByteUUIDPayload();

    const deadline = new BN(Date.now() / 1000 + 60 * 30); // 30 minutes later
    const message = Buffer.concat([
      payload,
      nonce.toArrayLike(Buffer, "le", 8),
      deadline.toArrayLike(Buffer, "le", 8),
    ]);

    const messageHash = keccak("keccak256").update(message).digest();
    const hashedMessageBase58 = bs58.encode(messageHash);
    const digest =  new TextEncoder().encode(`${SIGN_MESSAGE_PREFIX}${hashedMessageBase58}`);

    const privateKey = user.secretKey.slice(0, 32);

    const signature = await ed.signAsync(digest, privateKey);

    const recoverInfo = {
      signature: Array.from(signature),
      payload: Array.from(payload),
      deadline,
    };

    const vaultBalanceBefore = await program.provider.connection.getBalance(
      userAccount.vault
    );

    const { signature: txSignature } = await program.methods
    .pay(recoverInfo, amountToTransfer)
    .accountsPartial({
      user: user.publicKey,
      treasury: treasury.publicKey,
      bot: bot.publicKey,
    })
    .signers([bot])
    .rpcAndKeys();

    console.log("pay:", txSignature);

    const vaultBalanceAfter = await program.provider.connection.getBalance(
      userAccount.vault
    );

    assert.equal(vaultBalanceBefore - vaultBalanceAfter, amountToTransfer.toNumber());
  });
});
