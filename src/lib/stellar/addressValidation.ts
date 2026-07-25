import { Keypair } from '@stellar/stellar-sdk';

/**
 * Validates a Stellar address format (G followed by 55 base32 characters)
 */
export function isValidStellarAddress(address: string): boolean {
  if (!address || typeof address !== 'string') {
    return false;
  }
  
  // Stellar addresses are 56 characters: G + 55 base32 characters
  if (address.length !== 56) {
    return false;
  }
  
  // Must start with G (for public keys)
  if (!address.startsWith('G')) {
    return false;
  }
  
  // Validate using Stellar SDK
  try {
    Keypair.fromPublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates a Stellar secret key (S followed by 55 base32 characters)
 */
export function isValidSecretKey(secret: string): boolean {
  if (!secret || typeof secret !== 'string') {
    return false;
  }
  
  if (secret.length !== 56) {
    return false;
  }
  
  if (!secret.startsWith('S')) {
    return false;
  }
  
  try {
    Keypair.fromSecret(secret);
    return true;
  } catch {
    return false;
  }
}

/**
 * Shortens a Stellar address for display
 */
export function shortenAddress(address: string, prefixLength = 8, suffixLength = 4): string {
  if (address.length <= prefixLength + suffixLength) {
    return address;
  }
  return `${address.slice(0, prefixLength)}...${address.slice(-suffixLength)}`;
}
