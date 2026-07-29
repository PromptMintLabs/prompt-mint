import { IndexerState } from "../models/IndexerState";
import { startIndexer } from "../services/indexer";

jest.mock("../models/IndexerState");
jest.mock("@stellar/stellar-sdk/rpc", () => {
  const mockGetLatestLedger = jest.fn();
  const mockGetEvents = jest.fn();
  const instance = { getLatestLedger: mockGetLatestLedger, getEvents: mockGetEvents };
  return {
    Server: jest.fn().mockImplementation(() => instance),
    __testInstance: instance,
  };
});

const mockSave = jest.fn();
const mockFindOneAndUpdate = IndexerState.findOneAndUpdate as jest.Mock;

let serverInstance: { getLatestLedger: jest.Mock; getEvents: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockFindOneAndUpdate.mockResolvedValue({
    lastIndexedLedger: 0,
    save: mockSave,
  });
  const rpc = jest.requireMock("@stellar/stellar-sdk/rpc");
  serverInstance = rpc.__testInstance;
});

afterEach(() => {
  jest.useRealTimers();
});

async function startAndWait(ms = 5000) {
  const promise = startIndexer();
  await jest.advanceTimersByTimeAsync(ms);
  await promise;
}

describe("indexer backfill", () => {
  it("uses INDEXER_START_LEDGER when lastIndexedLedger is 0", async () => {
    process.env.INDEXER_START_LEDGER = "1000";
    serverInstance.getLatestLedger.mockResolvedValue({ sequence: 1005 });
    serverInstance.getEvents.mockResolvedValue({ events: [] });

    await startAndWait();

    expect(serverInstance.getEvents).toHaveBeenCalledWith(
      expect.objectContaining({ startLedger: 1000 }),
    );
  });

  it("batches large gaps into 2000-ledger chunks", async () => {
    delete process.env.INDEXER_START_LEDGER;
    serverInstance.getLatestLedger.mockResolvedValue({ sequence: 5000 });
    serverInstance.getEvents.mockResolvedValue({ events: [] });

    await startAndWait();

    expect(serverInstance.getEvents).toHaveBeenCalledTimes(3);
    expect(serverInstance.getEvents).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ startLedger: 1 }),
    );
    expect(serverInstance.getEvents).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ startLedger: 2001 }),
    );
    expect(serverInstance.getEvents).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ startLedger: 4001 }),
    );
  });

  it("updates cursor to chain tip after processing", async () => {
    serverInstance.getLatestLedger.mockResolvedValue({ sequence: 5000 });
    serverInstance.getEvents.mockResolvedValue({ events: [] });

    await startAndWait();

    expect(mockSave).toHaveBeenCalled();
  });
});
