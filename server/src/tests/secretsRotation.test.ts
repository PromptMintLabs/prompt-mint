import { isKeyValid, computeExpirationDate, computeGracePeriodDate } from "../services/apiKeys";
import { autoRotateExpiringApiKeys, runAutomatedSecretsRotationCycle } from "../services/secretsRotationService";
import ApiKey from "../models/ApiKey";
import mongoose from "mongoose";

jest.mock("../db/connectDb", () => jest.fn().mockResolvedValue(undefined));
jest.mock("../services/auditTrail", () => ({
  recordAuditEvent: jest.fn(),
}));

describe("Automated API Key and Secrets Rotation (#255)", () => {
  describe("isKeyValid with overlapping validity window", () => {
    it("returns true for an unrevoked key within its 90-day lifespan", () => {
      const now = new Date();
      const key = {
        revoked: false,
        expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      };
      expect(isKeyValid(key, now)).toBe(true);
    });

    it("returns false for a key whose 90-day expiresAt has passed", () => {
      const now = new Date();
      const key = {
        revoked: false,
        expiresAt: new Date(now.getTime() - 1000),
      };
      expect(isKeyValid(key, now)).toBe(false);
    });

    it("returns true for a revoked/rotated key whose overlapping grace period has NOT expired", () => {
      const now = new Date();
      const key = {
        revoked: true,
        gracePeriodUntil: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000), // 3 days remaining in grace window
      };
      expect(isKeyValid(key, now)).toBe(true);
    });

    it("returns false for a revoked/rotated key whose grace period has expired", () => {
      const now = new Date();
      const key = {
        revoked: true,
        gracePeriodUntil: new Date(now.getTime() - 1000), // grace period passed
      };
      expect(isKeyValid(key, now)).toBe(false);
    });

    it("returns false for an immediately revoked key without grace period", () => {
      const now = new Date();
      const key = {
        revoked: true,
        gracePeriodUntil: null,
      };
      expect(isKeyValid(key, now)).toBe(false);
    });
  });

  describe("autoRotateExpiringApiKeys", () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    it("identifies keys older than 90 days, rotates them with grace window, and saves replacement", async () => {
      const now = new Date();
      const ninetyFiveDaysAgo = new Date(now.getTime() - 95 * 24 * 60 * 60 * 1000);

      const mockOldKey = {
        _id: new mongoose.Types.ObjectId(),
        ownerWallet: "gtestwallet1234567890abcdef1234567890abcdef",
        label: "Production Backend",
        prefix: "oldpref1",
        scopes: ["read", "write"],
        rateLimitTier: "pro",
        revoked: false,
        createdAt: ninetyFiveDaysAgo,
        save: jest.fn().mockResolvedValue(undefined),
      };

      const findSpy = jest.spyOn(ApiKey, "find").mockResolvedValue([mockOldKey] as any);
      const createSpy = jest.spyOn(ApiKey, "create").mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        prefix: "newpref2",
      } as any);
      const updateManySpy = jest.spyOn(ApiKey, "updateMany").mockResolvedValue({ modifiedCount: 0 } as any);

      const result = await autoRotateExpiringApiKeys(90);

      expect(findSpy).toHaveBeenCalled();
      expect(mockOldKey.revoked).toBe(true);
      expect(mockOldKey.gracePeriodUntil).toBeDefined();
      expect(mockOldKey.save).toHaveBeenCalled();

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerWallet: mockOldKey.ownerWallet,
          rotatedFrom: "oldpref1",
          autoRotated: true,
        }),
      );

      expect(result.rotatedCount).toBe(1);
      expect(result.rotatedKeys[0].prefix).toBe("oldpref1");
    });
  });
});
