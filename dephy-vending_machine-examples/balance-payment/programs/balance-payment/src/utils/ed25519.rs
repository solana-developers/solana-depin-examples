// from https://github.com/stegaBOB/solana_ed25519_verify/blob/main/src/lib.rs

use anchor_lang::solana_program::pubkey::Pubkey;
use anyhow::{bail, Context};
use arrayref::array_ref;
use curve25519_dalek::scalar::Scalar;
use sha2::Digest;
use solana_zk_token_sdk::curve25519::{
    edwards::{multiply_edwards, subtract_edwards, validate_edwards, PodEdwardsPoint},
    scalar::PodScalar,
};

// funny number
const EDWARDS_BASE_POINT: PodEdwardsPoint = PodEdwardsPoint([
    0x58, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66,
    0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66,
]);

pub fn verify_signature(
    pubkey: &Pubkey,
    signature: &[u8; 64],
    message: &[u8],
) -> anyhow::Result<bool> {
    let a = PodEdwardsPoint(pubkey.to_bytes());
    let r = PodEdwardsPoint(*array_ref![signature, 0, 32]);
    if !validate_edwards(&a) {
        bail!("Pubkey is not a valid EdwardsPoint")
    }
    if !validate_edwards(&r) {
        bail!("Signature R is not a valid EdwardsPoint")
    }

    let s = array_ref![signature, 32, 32];
    let s_scalar = Scalar::from_bytes_mod_order(*s);
    let s_scalar = PodScalar(s_scalar.to_bytes());

    let mut hasher = sha2::Sha512::new();
    // R || A || M
    hasher.update(r.0);
    hasher.update(a.0);
    hasher.update(message);
    let hash_bytes = hasher.finalize();
    let hash_array = array_ref![hash_bytes, 0, 64];
    let h_scalar = Scalar::from_bytes_mod_order_wide(hash_array);
    let h_scalar = PodScalar(h_scalar.to_bytes());

    let s_b = multiply_edwards(&s_scalar, &EDWARDS_BASE_POINT).context("Failed to multiply S*B")?;
    let h_a = multiply_edwards(&h_scalar, &a).context("Failed to multiply H*A")?;
    let r_prime = subtract_edwards(&s_b, &h_a).context("Failed to subtract HA from SB")?;
    Ok(r_prime == r)
}
