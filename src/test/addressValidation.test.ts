import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isValidStellarAddress,
  isValidSecretKey,
  shortenAddress,
} from '../lib/stellar/addressValidation';

describe('Stellar Address Validation', () => {
  // Valid Stellar test addresses (generated from real keypairs)
  const VALID_ADDRESS = 'GBTX5KOA73DVVDSKOE5UQEQ2L3LWPMSRSDIY2S6YLY6EVVAEWN3UEQ7I';
  const VALID_SECRET = 'SBOE52LALJSFKRZ2BZXYBTNFBRXA6MIBX4FBTVFHJQS4JRWMLUW7FBUU';

  describe('isValidStellarAddress', () => {
    it('validates a correct Stellar public key', () => {
      expect(isValidStellarAddress(VALID_ADDRESS)).toBe(true);
    });

    it('rejects empty address', () => {
      expect(isValidStellarAddress('')).toBe(false);
    });

    it('rejects null/undefined', () => {
      expect(isValidStellarAddress(null as any)).toBe(false);
      expect(isValidStellarAddress(undefined as any)).toBe(false);
    });

    it('rejects non-string input', () => {
      expect(isValidStellarAddress(123 as any)).toBe(false);
    });

    it('rejects address with wrong length', () => {
      expect(isValidStellarAddress('GBTX5KOA73DVVDSKOE5U')).toBe(false);
      expect(isValidStellarAddress(VALID_ADDRESS + 'X')).toBe(false);
    });

    it('rejects address not starting with G', () => {
      const wrongPrefix = VALID_SECRET; // Starts with S
      expect(isValidStellarAddress(wrongPrefix)).toBe(false);
    });
  });

  describe('isValidSecretKey', () => {
    it('validates a correct Stellar secret key', () => {
      expect(isValidSecretKey(VALID_SECRET)).toBe(true);
    });

    it('rejects empty secret', () => {
      expect(isValidSecretKey('')).toBe(false);
    });

    it('rejects address (wrong prefix)', () => {
      expect(isValidSecretKey(VALID_ADDRESS)).toBe(false);
    });
  });

  describe('shortenAddress', () => {
    it('shortens a long address', () => {
      const shortened = shortenAddress(VALID_ADDRESS);
      expect(shortened).toBe('GBTX5KOA...EQ7I');
    });

    it('does not shorten short addresses', () => {
      const short = 'GBTX5KOA';
      expect(shortenAddress(short)).toBe(short);
    });

    it('respects custom prefix/suffix lengths', () => {
      const shortened = shortenAddress(VALID_ADDRESS, 4, 4);
      expect(shortened).toBe('GBTX...EQ7I');
    });
  });
});
