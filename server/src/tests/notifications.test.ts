import httpMocks from "node-mocks-http";
import connectDb from "../db/connectDb";
import Notification from "../models/Notification";
import Purchase from "../models/Purchase";
import User from "../models/User";
import { createPromptUpdateNotifications } from "../services/notificationService";
import {
  GetNotifications,
  MarkNotificationRead,
  ExportNotifications,
} from "../controllers/notificationControllers";

jest.mock("../db/connectDb");
jest.mock("../models/Notification");
jest.mock("../models/Purchase");
jest.mock("../models/User");

const mockConnectDb = connectDb as jest.Mock;
const mockNotification = Notification as jest.Mocked<any>;
const mockPurchase = Purchase as jest.Mocked<any>;
const mockUser = User as jest.Mocked<any>;

describe("Notification flow", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockConnectDb.mockResolvedValue(true);
  });

  it("creates notifications for buyers when a new version is published", async () => {
    mockPurchase.find.mockResolvedValue([
      { buyerWallet: "gbuyer1" },
      { buyerWallet: "gbuyer2" },
      { buyerWallet: "gbuyer1" },
    ]);
    mockUser.find.mockResolvedValue([
      { _id: "user1", walletAddress: "gbuyer1" },
      { _id: "user2", walletAddress: "gbuyer2" },
    ]);
    mockNotification.create.mockResolvedValue({});

    await createPromptUpdateNotifications({
      promptId: "abc123",
      promptTitle: "Launch Pack",
      versionIndex: 2,
      changelog: "This is a new update with a long explanation.",
    });

    expect(mockNotification.create).toHaveBeenCalledTimes(2);
    expect(mockNotification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        promptId: "abc123",
        versionIndex: 2,
        walletAddress: "gbuyer1",
        message: expect.stringContaining("New version of Launch Pack is available (v2):"),
      }),
    );
  });

  it("does not fail when notification delivery fails", async () => {
    mockPurchase.find.mockResolvedValue([{ buyerWallet: "gbuyer1" }]);
    mockUser.find.mockResolvedValue([{ _id: "user1", walletAddress: "gbuyer1" }]);
    mockNotification.create.mockRejectedValue(new Error("database failure"));

    await expect(
      createPromptUpdateNotifications({
        promptId: "abc123",
        promptTitle: "Launch Pack",
        versionIndex: 2,
        changelog: "An update",
      }),
    ).resolves.not.toThrow();
    expect(mockNotification.create).toHaveBeenCalledTimes(1);
  });

  it("returns unread notifications for an authenticated user", async () => {
    const req = httpMocks.createRequest({
      method: "GET",
      url: "/api/notifications",
      query: { walletAddress: "GBUYER" },
    });
    const res = httpMocks.createResponse();
    mockUser.findOne.mockResolvedValue({ _id: "user1", walletAddress: "gbuyer" });
    mockNotification.find.mockResolvedValue([
      { _id: "note1", promptId: "abc123", message: "Test", read: false },
    ]);

    await GetNotifications(req, res);

    expect(res.statusCode).toBe(200);
    expect(res._getJSONData().notifications).toHaveLength(1);
    expect(res._getJSONData().notifications[0].message).toBe("Test");
  });

  it("marks a notification as read", async () => {
    const req = httpMocks.createRequest({
      method: "PATCH",
      url: "/api/notifications/note1/read",
      params: { id: "note1" },
      body: { walletAddress: "GBUYER" },
    });
    const res = httpMocks.createResponse();
    mockUser.findOne.mockResolvedValue({ _id: "user1", walletAddress: "gbuyer" });
    mockNotification.findOneAndUpdate.mockResolvedValue({ _id: "note1", read: true });

    await MarkNotificationRead(req, res);

    expect(res.statusCode).toBe(200);
    expect(res._getJSONData().notification.read).toBe(true);
  });

  it("exports the full notification history as a JSON attachment", async () => {
    const req = httpMocks.createRequest({
      method: "GET",
      url: "/api/notifications/export",
      query: { walletAddress: "GBUYER" },
    });
    const res = httpMocks.createResponse();
    mockUser.findOne.mockResolvedValue({ _id: "user1", walletAddress: "gbuyer" });
    mockNotification.find.mockResolvedValue([
      { _id: "note2", promptId: "abc123", message: "Read update", read: true },
      { _id: "note1", promptId: "abc123", message: "Unread update", read: false },
    ]);

    await ExportNotifications(req, res);

    expect(res.statusCode).toBe(200);
    expect(String(res.getHeader("Content-Type"))).toContain("application/json");
    expect(String(res.getHeader("Content-Disposition"))).toContain("attachment");
    const body = JSON.parse(res._getData());
    // Export includes read and unread notifications, not just the unread feed.
    expect(body.count).toBe(2);
    expect(body.notifications).toHaveLength(2);
    expect(body.walletAddress).toBe("gbuyer");
    // Newest first, and scoped to the owning user.
    expect(mockNotification.find).toHaveBeenCalledWith(
      { userId: "user1" },
      undefined,
      { sort: { createdAt: -1 } },
    );
  });

  it("exports the full notification history as a CSV attachment", async () => {
    const req = httpMocks.createRequest({
      method: "GET",
      url: "/api/notifications/export?format=csv",
      query: { walletAddress: "GBUYER", format: "csv" },
    });
    const res = httpMocks.createResponse();
    mockUser.findOne.mockResolvedValue({ _id: "user1", walletAddress: "gbuyer" });
    mockNotification.find.mockResolvedValue([
      {
        _id: "note2",
        promptId: "abc123",
        versionIndex: 2,
        walletAddress: "gbuyer",
        message: 'He said "hi", ok',
        read: true,
        createdAt: new Date("2024-01-02T03:04:05.000Z"),
        updatedAt: new Date("2024-01-02T03:04:05.000Z"),
      },
    ]);

    await ExportNotifications(req, res);

    expect(res.statusCode).toBe(200);
    expect(String(res.getHeader("Content-Type"))).toContain("text/csv");
    expect(String(res.getHeader("Content-Disposition"))).toContain("attachment");
    const csv = res._getData() as string;
    expect(csv.split("\n")[0]).toBe(
      "id,promptId,versionIndex,walletAddress,message,read,createdAt,updatedAt",
    );
    // Commas and quotes in the message are escaped per RFC 4180.
    expect(csv).toContain('"He said ""hi"", ok"');
    expect(csv).toContain("2024-01-02T03:04:05.000Z");
  });

  it("requires a wallet address to export notifications", async () => {
    const req = httpMocks.createRequest({
      method: "GET",
      url: "/api/notifications/export",
      query: {},
    });
    const res = httpMocks.createResponse();

    await ExportNotifications(req, res);

    expect(res.statusCode).toBe(401);
  });

  it("rejects unsupported notification export formats", async () => {
    const req = httpMocks.createRequest({
      method: "GET",
      url: "/api/notifications/export?format=xml",
      query: { walletAddress: "GBUYER", format: "xml" },
    });
    const res = httpMocks.createResponse();

    await ExportNotifications(req, res);

    expect(res.statusCode).toBe(400);
    expect(res._getJSONData().code).toBe("INVALID_INPUT");
  });
});
