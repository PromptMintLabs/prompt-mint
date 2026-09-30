jest.mock("../db/connectDb", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("../models/User", () => ({ __esModule: true, default: { find: jest.fn() } }));
jest.mock("../models/Prompt", () => ({ __esModule: true, default: { find: jest.fn() } }));
jest.mock("../models/Purchase", () => ({ __esModule: true, default: { find: jest.fn() } }));
jest.mock("../models/CreatorDigestDelivery", () => ({
  __esModule: true,
  default: { findOneAndUpdate: jest.fn(), updateOne: jest.fn() },
}));
jest.mock("./emailNotifications", () => ({ sendWeeklyCreatorMetricsDigest: jest.fn() }));

import connectDb from "../db/connectDb";
import CreatorDigestDelivery from "../models/CreatorDigestDelivery";
import Prompt from "../models/Prompt";
import Purchase from "../models/Purchase";
import User from "../models/User";
import { sendWeeklyCreatorMetricsDigest } from "./emailNotifications";
import { getPreviousUtcWeek, sendWeeklyCreatorMetricsDigests } from "./creatorMetricsDigest";

const mockUserFind = User.find as jest.Mock;
const mockPromptFind = Prompt.find as jest.Mock;
const mockPurchaseFind = Purchase.find as jest.Mock;
const mockClaim = CreatorDigestDelivery.findOneAndUpdate as jest.Mock;
const mockUpdateDelivery = CreatorDigestDelivery.updateOne as jest.Mock;
const mockSendDigest = sendWeeklyCreatorMetricsDigest as jest.Mock;

function queryReturning(value: unknown[]) {
  const query: any = {
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(value),
  };
  return query;
}

beforeEach(() => {
  jest.resetAllMocks();
  (connectDb as jest.Mock).mockResolvedValue(undefined);
  mockClaim.mockResolvedValue({ status: "sending" });
  mockUpdateDelivery.mockResolvedValue({ acknowledged: true });
  mockSendDigest.mockResolvedValue(true);
});

describe("getPreviousUtcWeek", () => {
  it("returns the previous complete Monday-to-Sunday UTC week", () => {
    expect(getPreviousUtcWeek(new Date("2025-04-14T09:00:00.000Z"))).toMatchObject({
      weekStart: "2025-04-07",
      weekEnd: "2025-04-13",
      start: new Date("2025-04-07T00:00:00.000Z"),
      endExclusive: new Date("2025-04-14T00:00:00.000Z"),
    });
  });
});

describe("sendWeeklyCreatorMetricsDigests", () => {
  it("sends one idempotent digest with weekly sales, revenue, buyers, and top listing", async () => {
    mockUserFind.mockReturnValue(queryReturning([
      { _id: "creator-1", walletAddress: "GCREATOR", email: "creator@example.com" },
    ]));
    mockPromptFind.mockReturnValue(queryReturning([
      { _id: "prompt-1", owner: "creator-1", title: "Launch planner", price: 25_000_000 },
    ]));
    mockPurchaseFind.mockReturnValue(queryReturning([
      { promptId: "prompt-1", buyerWallet: "GBUYER1" },
      { promptId: "prompt-1", buyerWallet: "GBUYER2" },
    ]));

    const result = await sendWeeklyCreatorMetricsDigests(new Date("2025-04-14T09:00:00.000Z"));

    expect(mockUserFind).toHaveBeenCalledWith({
      email: { $type: "string", $ne: "" },
      "notificationPreferences.emailNotifications": { $ne: false },
      "notificationPreferences.weeklyCreatorDigest": true,
    });
    expect(mockSendDigest).toHaveBeenCalledWith("creator@example.com", {
      weekStart: "2025-04-07",
      weekEnd: "2025-04-13",
      salesCount: 2,
      revenueStroops: 50_000_000,
      buyerCount: 2,
      topPromptTitle: "Launch planner",
    });
    expect(mockClaim).toHaveBeenCalledTimes(1);
    expect(mockUpdateDelivery).toHaveBeenCalledWith(
      { creatorWallet: "gcreator", weekStart: "2025-04-07" },
      { $set: { status: "sent", sentAt: new Date("2025-04-14T09:00:00.000Z") }, $unset: { claimedAt: 1 } },
    );
    expect(result).toEqual({ sent: 1, skipped: 0 });
  });

  it("does not resend a digest when the weekly delivery is already claimed", async () => {
    mockUserFind.mockReturnValue(queryReturning([
      { _id: "creator-1", walletAddress: "GCREATOR", email: "creator@example.com" },
    ]));
    mockPromptFind.mockReturnValue(queryReturning([
      { _id: "prompt-1", owner: "creator-1", title: "Launch planner", price: 25_000_000 },
    ]));
    mockPurchaseFind.mockReturnValue(queryReturning([
      { promptId: "prompt-1", buyerWallet: "GBUYER1" },
    ]));
    mockClaim.mockResolvedValue(null);

    await expect(sendWeeklyCreatorMetricsDigests(new Date("2025-04-14T09:00:00.000Z")))
      .resolves.toEqual({ sent: 0, skipped: 1 });
    expect(mockSendDigest).not.toHaveBeenCalled();
  });
});