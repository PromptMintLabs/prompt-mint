import mongoose from "mongoose";
import Prompt from "../models/Prompt";
import MarketplaceTransaction from "../models/MarketplaceTransaction";
import Purchase from "../models/Purchase";

function getIndexes(schema: mongoose.Schema): Array<{ fields: Record<string, number>; options?: Record<string, unknown> }> {
  return schema.indexes().map(([fields, options]) => ({ fields, options }));
}

function findIndex(
  indexes: Array<{ fields: Record<string, number>; options?: Record<string, unknown> }>,
  fields: Record<string, number>,
) {
  return indexes.find((idx) => {
    const keys = Object.keys(fields);
    if (keys.length !== Object.keys(idx.fields).length) return false;
    return keys.every((k) => idx.fields[k] === fields[k]);
  });
}

describe("Prompt model indexes", () => {
  const promptIndexes = getIndexes(Prompt.schema);

  it("has a compound index for the main marketplace listing query", () => {
    const idx = findIndex(promptIndexes, { listingStatus: 1, isActive: 1, createdAt: -1 });
    expect(idx).toBeDefined();
  });

  it("has a compound index for category-filtered marketplace queries", () => {
    const idx = findIndex(promptIndexes, { listingStatus: 1, isActive: 1, category: 1, createdAt: -1 });
    expect(idx).toBeDefined();
  });

  it("has a compound index for tag-based search", () => {
    const idx = findIndex(promptIndexes, { listingStatus: 1, isActive: 1, tags: 1, createdAt: -1 });
    expect(idx).toBeDefined();
  });

  it("has a compound index for price-based filtering", () => {
    const idx = findIndex(promptIndexes, { listingStatus: 1, isActive: 1, price: 1, createdAt: -1 });
    expect(idx).toBeDefined();
  });

  it("has a compound index for rating-based sorting", () => {
    const idx = findIndex(promptIndexes, { listingStatus: 1, isActive: 1, rating: 1, createdAt: -1 });
    expect(idx).toBeDefined();
  });

  it("has a compound index for owned prompts", () => {
    const idx = findIndex(promptIndexes, { owner: 1, createdAt: -1 });
    expect(idx).toBeDefined();
  });

  it("has a compound index for draft prompts", () => {
    const idx = findIndex(promptIndexes, { owner: 1, listingStatus: 1, updatedAt: -1 });
    expect(idx).toBeDefined();
  });

  it("has a compound index for saved prompts", () => {
    const idx = findIndex(promptIndexes, { savedPrompts: 1, createdAt: -1 });
    expect(idx).toBeDefined();
  });

  it("has a compound index for preview stats queries", () => {
    const idx = findIndex(promptIndexes, { owner: 1, previewCount: -1 });
    expect(idx).toBeDefined();
  });

  it("has a compound index for onChainId + isActive lookups", () => {
    const idx = findIndex(promptIndexes, { onChainId: 1, isActive: 1 });
    expect(idx).toBeDefined();
  });

  it("keeps the existing title index", () => {
    const idx = findIndex(promptIndexes, { title: 1 });
    expect(idx).toBeDefined();
  });

  it("keeps the existing single-field indexes (title, similarityFlag, onChainId, isActive, listingStatus)", () => {
    for (const field of ["title", "similarityFlag", "onChainId", "isActive", "listingStatus"]) {
      const idx = findIndex(promptIndexes, { [field]: 1 });
      expect(idx).toBeDefined();
    }
  });
});

describe("MarketplaceTransaction model indexes", () => {
  const txIndexes = getIndexes(MarketplaceTransaction.schema);

  it("has a compound index for buyer transaction history queries", () => {
    const idx = findIndex(txIndexes, { buyerWallet: 1, occurredAt: -1 });
    expect(idx).toBeDefined();
  });

  it("has a compound index for creator transaction history queries", () => {
    const idx = findIndex(txIndexes, { creatorWallet: 1, occurredAt: -1 });
    expect(idx).toBeDefined();
  });

  it("has a compound index for prompt-specific transaction queries", () => {
    const idx = findIndex(txIndexes, { promptOnChainId: 1, occurredAt: -1 });
    expect(idx).toBeDefined();
  });

  it("keeps the unique sparse compound index for deduplication", () => {
    const idx = findIndex(txIndexes, { buyerWallet: 1, promptOnChainId: 1, txHash: 1 });
    expect(idx).toBeDefined();
    expect(idx?.options?.unique).toBe(true);
    expect(idx?.options?.sparse).toBe(true);
  });

  it("keeps the existing single-field indexes", () => {
    for (const field of ["promptMongoId", "buyerWallet", "creatorWallet", "txHash", "occurredAt"]) {
      const idx = findIndex(txIndexes, { [field]: 1 });
      expect(idx).toBeDefined();
    }
  });
});

describe("Purchase model indexes", () => {
  const purchaseIndexes = getIndexes(Purchase.schema);

  it("has a compound index for buyer purchase history", () => {
    const idx = findIndex(purchaseIndexes, { buyerWallet: 1, createdAt: -1 });
    expect(idx).toBeDefined();
  });

  it("has a compound index for prompt purchase history", () => {
    const idx = findIndex(purchaseIndexes, { promptId: 1, createdAt: -1 });
    expect(idx).toBeDefined();
  });

  it("keeps the existing unique compound index", () => {
    const idx = findIndex(purchaseIndexes, { promptId: 1, buyerWallet: 1 });
    expect(idx).toBeDefined();
  });

  it("keeps the existing single-field indexes", () => {
    for (const field of ["promptId", "buyerWallet", "saved"]) {
      const idx = findIndex(purchaseIndexes, { [field]: 1 });
      expect(idx).toBeDefined();
    }
  });
});
