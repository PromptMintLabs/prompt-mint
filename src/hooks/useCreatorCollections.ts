import { useCallback, useEffect, useState } from "react";
import {
  listCollections,
  getCollection,
  createCollection,
  renameCollection,
  archiveCollection,
  unarchiveCollection,
  deleteCollection,
  addPromptToCollection,
  removePromptFromCollection,
  reorderCollection,
  type PromptCollection,
} from "@/lib/collections/store";
import { useWallet } from "@/hooks/useWallet";

interface UseCreatorCollectionsReturn {
  collections: PromptCollection[];
  activeCollections: PromptCollection[];
  isLoading: boolean;
  create: (_name: string, _description?: string) => PromptCollection | null;
  rename: (_id: string, _newName: string) => boolean;
  archive: (_id: string) => boolean;
  unarchive: (_id: string) => boolean;
  remove: (_id: string) => boolean;
  addPrompt: (_collectionId: string, _promptId: string) => boolean;
  removePrompt: (_collectionId: string, _promptId: string) => boolean;
  reorder: (_collectionId: string, _promptIds: string[]) => boolean;
  getById: (_id: string) => PromptCollection | undefined;
  refresh: () => void;
}

/**
 * Wallet-scoped hook for managing creator collections.
 * All operations are keyed to the connected wallet address.
 */
export function useCreatorCollections(): UseCreatorCollectionsReturn {
  const { address } = useWallet();
  const [collections, setCollections] = useState<PromptCollection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const walletAddress = address;

  const refresh = useCallback(() => {
    if (!walletAddress) {
      setCollections([]);
      setIsLoading(false);
      return;
    }
    setCollections(listCollections(walletAddress));
    setIsLoading(false);
  }, [walletAddress]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    (name: string, description?: string) => {
      if (!walletAddress || !name.trim()) return null;
      const collection = createCollection(name, walletAddress, description);
      refresh();
      return collection;
    },
    [walletAddress, refresh],
  );

  const rename = useCallback(
    (id: string, newName: string) => {
      if (!walletAddress) return false;
      const result = renameCollection(id, newName, walletAddress);
      if (result) refresh();
      return result;
    },
    [walletAddress, refresh],
  );

  const archive = useCallback(
    (id: string) => {
      if (!walletAddress) return false;
      const result = archiveCollection(id, walletAddress);
      if (result) refresh();
      return result;
    },
    [walletAddress, refresh],
  );

  const unarchive = useCallback(
    (id: string) => {
      if (!walletAddress) return false;
      const result = unarchiveCollection(id, walletAddress);
      if (result) refresh();
      return result;
    },
    [walletAddress, refresh],
  );

  const remove = useCallback(
    (id: string) => {
      if (!walletAddress) return false;
      const result = deleteCollection(id, walletAddress);
      if (result) refresh();
      return result;
    },
    [walletAddress, refresh],
  );

  const addPrompt = useCallback(
    (collectionId: string, promptId: string) => {
      if (!walletAddress) return false;
      const result = addPromptToCollection(collectionId, promptId, walletAddress);
      if (result) refresh();
      return result;
    },
    [walletAddress, refresh],
  );

  const removePrompt = useCallback(
    (collectionId: string, promptId: string) => {
      if (!walletAddress) return false;
      const result = removePromptFromCollection(collectionId, promptId, walletAddress);
      if (result) refresh();
      return result;
    },
    [walletAddress, refresh],
  );

  const reorder = useCallback(
    (collectionId: string, promptIds: string[]) => {
      if (!walletAddress) return false;
      const result = reorderCollection(collectionId, promptIds, walletAddress);
      if (result) refresh();
      return result;
    },
    [walletAddress, refresh],
  );

  const getById = useCallback(
    (id: string) => {
      if (!walletAddress) return undefined;
      return getCollection(id, walletAddress);
    },
    [walletAddress],
  );

  return {
    collections,
    activeCollections: collections.filter((c) => !c.archived),
    isLoading,
    create,
    rename,
    archive,
    unarchive,
    remove,
    addPrompt,
    removePrompt,
    reorder,
    getById,
    refresh,
  };
}
