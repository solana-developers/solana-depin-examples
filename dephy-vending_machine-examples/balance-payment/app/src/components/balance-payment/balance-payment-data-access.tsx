import { getBalancePaymentProgram, getBalancePaymentProgramId } from '../../anchor'
import { Cluster } from '@solana/web3.js'
import { v4 as uuidv4 } from "uuid";
import { useMemo } from 'react'
import { useCluster } from '../cluster/cluster-data-access'
import { useAnchorProvider } from '../solana/solana-provider'
import { BN, web3 } from '@coral-xyz/anchor'

export function useBalancePaymentProgram() {
  const { cluster } = useCluster()
  const provider = useAnchorProvider()
  const programId = useMemo(() => getBalancePaymentProgramId(cluster.network as Cluster), [cluster])
  const program = useMemo(() => getBalancePaymentProgram(provider, programId), [provider, programId])

  const getGlobalPubkey = () => {
    const [globalAccountPubkey, _] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("GLOBAL")],
      programId
    );
    return globalAccountPubkey;
  }

  const getUserAccountPubkey = (user: web3.PublicKey) => {
    const [userAccountPubkey, _] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("USER"), user.toBuffer()],
      programId
    );
    return userAccountPubkey;
  };

  const getUserVaultPubkey = (user: web3.PublicKey) => {
    const [vaultPubkey, _] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("VAULT"), user.toBuffer()],
      programId
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

  const generate64ByteUUIDPayload = () => {
    const uuid = uuidv4().replace(/-/g, ""); // 去掉连字符
    const uuidBuffer = Buffer.from(uuid, "hex");

    const extendedBuffer = Buffer.concat([uuidBuffer, Buffer.alloc(48, 0)]);

    return {
      uuid,
      uuidBytes: extendedBuffer
    };
  };

  return {
    program,
    programId,
    getGlobalPubkey,
    getUserAccountPubkey,
    getUserVaultPubkey,
    getLockAccountPubkey,
    generate64ByteUUIDPayload
  }
}
