jest.mock("nodemailer", () => ({
  __esModule: true,
  default: { createTransport: jest.fn() },
}));
jest.mock("./circuitBreaker", () => ({
  getCircuitBreaker: () => ({ execute: (operation: () => Promise<unknown>) => operation() }),
}));

import nodemailer from "nodemailer";
import { sendWeeklyCreatorMetricsDigest } from "./emailNotifications";

describe("sendWeeklyCreatorMetricsDigest", () => {
  const originalHost = process.env.EMAIL_SMTP_HOST;
  const sendMail = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EMAIL_SMTP_HOST = "smtp.test";
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });
  });

  afterAll(() => {
    if (originalHost === undefined) delete process.env.EMAIL_SMTP_HOST;
    else process.env.EMAIL_SMTP_HOST = originalHost;
  });

  it("sends precise revenue and escapes listing titles in the email", async () => {
    const sent = await sendWeeklyCreatorMetricsDigest("creator@example.com", {
      weekStart: "2025-04-07",
      weekEnd: "2025-04-13",
      salesCount: 1,
      revenueStroops: 1,
      buyerCount: 1,
      topPromptTitle: "<script>alert('x')</script>",
    });

    expect(sent).toBe(true);
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: "creator@example.com",
      subject: expect.stringContaining("2025-04-07"),
      html: expect.stringContaining("0.0000001 XLM"),
    }));
    const html = sendMail.mock.calls[0][0].html;
    expect(html).toContain("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("does not claim delivery when SMTP is not configured", async () => {
    delete process.env.EMAIL_SMTP_HOST;

    await expect(sendWeeklyCreatorMetricsDigest("creator@example.com", {
      weekStart: "2025-04-07",
      weekEnd: "2025-04-13",
      salesCount: 0,
      revenueStroops: 0,
      buyerCount: 0,
      topPromptTitle: "",
    })).resolves.toBe(false);
  });
});