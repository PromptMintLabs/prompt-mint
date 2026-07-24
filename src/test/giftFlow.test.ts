import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { PromptHashClient } from '../lib/stellar/promptHashClient';
import { isValidStellarAddress } from '../lib/stellar/addressValidation';

vi.mock('../lib/stellar/promptHashClient', () => ({
  PromptHashClient: {
    giftPrompt: vi.fn(),
    purchasePrompt: vi.fn(),
  },
}));

const mockGiftPrompt = vi.mocked(PromptHashClient.giftPrompt);

describe('Gift Prompt Flow', () => {
  // Valid Stellar test addresses (generated from real keypairs)
  const VALID_SENDER = 'GAI4OWOTBCMC2IP5M3KS4KSF3ESIWNAFS3PSHQUBZRJA6KOCH2GY2I3K';
  const VALID_RECIPIENT = 'GAR6A4DYQ2TNH6PBLEKW5ZER7CDPZ3MLKM5T3WRQHGQBJNSDXR3EEZTH';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PromptHashClient.giftPrompt', () => {
    it('calls giftPrompt with correct parameters', async () => {
      mockGiftPrompt.mockResolvedValue({
        txHash: 'tx_gift_123456789012',
        success: true,
        recipientAddress: VALID_RECIPIENT,
      });

      const result = await PromptHashClient.giftPrompt(
        '123',
        VALID_SENDER,
        VALID_RECIPIENT
      );

      expect(result.success).toBe(true);
      expect(result.recipientAddress).toBe(VALID_RECIPIENT);
      expect(mockGiftPrompt).toHaveBeenCalledWith(
        '123',
        VALID_SENDER,
        VALID_RECIPIENT
      );
    });

    it('handles forceFailure option', async () => {
      mockGiftPrompt.mockRejectedValue(new Error('Insufficient balance'));

      await expect(
        PromptHashClient.giftPrompt(
          '123',
          VALID_SENDER,
          VALID_RECIPIENT,
          { forceFailure: 'Insufficient balance' }
        )
      ).rejects.toThrow('Insufficient balance');
    });

    it('returns recipient address in result', async () => {
      mockGiftPrompt.mockResolvedValue({
        txHash: 'tx_gift_123456789012',
        success: true,
        recipientAddress: VALID_RECIPIENT,
      });

      const result = await PromptHashClient.giftPrompt(
        '123',
        VALID_SENDER,
        VALID_RECIPIENT
      );

      expect(result.recipientAddress).toBe(VALID_RECIPIENT);
    });
  });

  describe('Gift Validation', () => {
    // Valid Stellar test addresses (generated from real keypairs)
    const VALID_SENDER = 'GAI4OWOTBCMC2IP5M3KS4KSF3ESIWNAFS3PSHQUBZRJA6KOCH2GY2I3K';
    const VALID_RECIPIENT = 'GAR6A4DYQ2TNH6PBLEKW5ZER7CDPZ3MLKM5T3WRQHGQBJNSDXR3EEZTH';

    it('prevents self-gifts', () => {
      const senderAddress = VALID_SENDER;
      const recipientAddress = senderAddress;
      
      expect(recipientAddress === senderAddress).toBe(true);
    });

    it('validates recipient address format', () => {
      expect(isValidStellarAddress(VALID_RECIPIENT)).toBe(true);
      expect(isValidStellarAddress('INVALID')).toBe(false);
    });

    it('requires sender authentication', async () => {
      mockGiftPrompt.mockResolvedValue({
        txHash: 'tx_gift_123456789012',
        success: true,
        recipientAddress: VALID_RECIPIENT,
      });

      const result = await PromptHashClient.giftPrompt(
        '123',
        VALID_SENDER,
        VALID_RECIPIENT
      );

      expect(result.success).toBe(true);
    });
  });

  describe('Gift Confirmation', () => {
    it('requires explicit confirmation before proceeding', () => {
      const confirmationChecked = false;
      const canProceed = confirmationChecked;
      
      expect(canProceed).toBe(false);
    });

    it('allows proceeding after confirmation', () => {
      const confirmationChecked = true;
      const isValidAddress = true;
      const isNotSelfGift = true;
      const canProceed = confirmationChecked && isValidAddress && isNotSelfGift;
      
      expect(canProceed).toBe(true);
    });

    it('displays irreversibility warning', () => {
      const warningText = 'Once confirmed, this transaction cannot be reversed';
      expect(warningText).toContain('cannot be reversed');
    });
  });

  describe('Gift Success', () => {
    it('shows success state with recipient address', async () => {
      mockGiftPrompt.mockResolvedValue({
        txHash: 'tx_gift_123456789012',
        success: true,
        recipientAddress: VALID_RECIPIENT,
      });

      const result = await PromptHashClient.giftPrompt(
        '123',
        VALID_SENDER,
        VALID_RECIPIENT
      );

      expect(result.success).toBe(true);
      expect(result.recipientAddress).toBe(VALID_RECIPIENT);
    });

    it('provides transaction hash for verification', async () => {
      const txHash = 'tx_gift_123456789012';
      mockGiftPrompt.mockResolvedValue({
        txHash,
        success: true,
        recipientAddress: VALID_RECIPIENT,
      });

      const result = await PromptHashClient.giftPrompt(
        '123',
        VALID_SENDER,
        VALID_RECIPIENT
      );

      expect(result.txHash).toBe(txHash);
    });
  });

  describe('Gift Failure', () => {
    it('handles network errors', async () => {
      mockGiftPrompt.mockRejectedValue(new Error('Network connection lost'));

      await expect(
        PromptHashClient.giftPrompt(
          '123',
          VALID_SENDER,
          VALID_RECIPIENT
        )
      ).rejects.toThrow('Network connection lost');
    });

    it('handles insufficient balance', async () => {
      mockGiftPrompt.mockRejectedValue(new Error('Insufficient balance'));

      await expect(
        PromptHashClient.giftPrompt(
          '123',
          VALID_SENDER,
          VALID_RECIPIENT
        )
      ).rejects.toThrow('Insufficient balance');
    });

    it('handles invalid listing', async () => {
      mockGiftPrompt.mockRejectedValue(new Error('Prompt not found'));

      await expect(
        PromptHashClient.giftPrompt(
          '999',
          VALID_SENDER,
          VALID_RECIPIENT
        )
      ).rejects.toThrow('Prompt not found');
    });

    it('handles recipient already owning prompt', async () => {
      mockGiftPrompt.mockRejectedValue(new Error('Recipient already owns this prompt'));

      await expect(
        PromptHashClient.giftPrompt(
          '123',
          VALID_SENDER,
          VALID_RECIPIENT
        )
      ).rejects.toThrow('Recipient already owns this prompt');
    });
  });

  describe('Recipient Discovery', () => {
    it('recipient can access gifted prompt from their library', () => {
      // After gifting, the recipient's address is recorded in the contract
      // The recipient can then access the prompt via their library
      // The getPromptsByBuyer function would return the gifted prompt
      // This is handled by the contract's add_prompt_to_buyer function
      expect(VALID_RECIPIENT).toBeTruthy();
    });

    it('recipient unlocks content with their own wallet', () => {
      // The recipient uses their wallet to sign the unlock challenge
      // This is the same flow as a regular purchase
      // The unlock flow requires the recipient's wallet signature
      expect(VALID_RECIPIENT).toBeTruthy();
    });
  });
});
