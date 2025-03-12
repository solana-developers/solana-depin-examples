use arrayref::array_ref;
use curve25519_dalek::scalar::Scalar;
use sha2::Digest;
use solana_program::pubkey::Pubkey;
use solana_zk_token_sdk::curve25519::edwards::multiply_edwards;
use solana_zk_token_sdk::curve25519::edwards::subtract_edwards;
use solana_zk_token_sdk::curve25519::edwards::validate_edwards;
use solana_zk_token_sdk::curve25519::edwards::PodEdwardsPoint;
use solana_zk_token_sdk::curve25519::scalar::PodScalar;

use crate::Error;

// funny number
const EDWARDS_BASE_POINT: PodEdwardsPoint = PodEdwardsPoint([
    0x58, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66,
    0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66,
]);

pub fn verify_signature(
    pubkey: &Pubkey,
    signature: &[u8; 64],
    message: &[u8],
) -> Result<bool, Error> {
    let a = PodEdwardsPoint(pubkey.to_bytes());
    let r = PodEdwardsPoint(*array_ref![signature, 0, 32]);
    if !validate_edwards(&a) {
        return Err(Error::SignatureVerificationFailed(
            "Pubkey is not a valid EdwardsPoint".to_string(),
        ));
    }
    if !validate_edwards(&r) {
        return Err(Error::SignatureVerificationFailed(
            "Signature R is not a valid EdwardsPoint".to_string(),
        ));
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

    let s_b = multiply_edwards(&s_scalar, &EDWARDS_BASE_POINT).ok_or(
        Error::SignatureVerificationFailed("Failed to multiply S*B".to_string()),
    )?;
    let h_a = multiply_edwards(&h_scalar, &a).ok_or(Error::SignatureVerificationFailed(
        "Failed to multiply H*A".to_string(),
    ))?;
    let r_prime = subtract_edwards(&s_b, &h_a).ok_or(Error::SignatureVerificationFailed(
        "Failed to subtract HA from SB".to_string(),
    ))?;
    Ok(r_prime == r)
}
