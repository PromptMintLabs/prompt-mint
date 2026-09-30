import { render, screen, act, waitFor } from '@testing-library/react';
import { WalletProvider, WalletContext } from '../WalletProvider';
import storage from '../../util/storage';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react'; // Ensure React is imported for the TestComponent
import { TransactionProvider } from '../../components/TransactionProvider';
import { wallet } from '../../util/wallet';

// 1. Partial Mock: Keeps WalletNetwork intact while mocking the Class
vi.mock('@creit.tech/stellar-wallets-kit', async (importOriginal: any) => {
    const actual = await importOriginal();
  return {
    ...actual,
    freighter: vi.fn(),
    albedo: vi.fn(),
    xbull: vi.fn(),
    StellarWalletsKit: vi.fn().mockImplementation(function() {
      return {
        setWallet: vi.fn(),
        getAddress: vi.fn().mockResolvedValue({ address: 'GABC123' }),
        getNetwork: vi.fn().mockResolvedValue({ 
          network: 'TESTNET', 
          networkPassphrase: 'Test SDF Network ; September 2015' 
        }),
        signTransaction: vi.fn(),
        signMessage: vi.fn(),
        disconnect: vi.fn().mockResolvedValue(undefined)
      };
    }),
  };
});

describe('WalletProvider Session Persistence', () => {
  beforeEach(() => {
    // 0. Clear any existing storage to avoid cross-test contamination
    if (storage.clear) {
      storage.clear();
    } else {
      ['walletId', 'walletAddress', 'walletNetwork', 'networkPassphrase']
        .forEach(key => storage.removeItem(key as any));
    }
  });

  it('should purge storage on disconnect', async () => {
    // 1. Mock existing storage values
    storage.setItem('walletId', 'freighter');
    storage.setItem('walletAddress', 'GABC123');

    const TestComponent = () => {
      const context = React.useContext(WalletContext);
      if (!context) return null;
      
      const { disconnect, address, status } = context;
      return (
        <div>
          <span data-testid="addr">{address}</span>
          <span data-testid="status">{status}</span>
          <button onClick={disconnect} disabled={status === 'reconnecting'}>Logout</button>
        </div>
      );
    };

    const { rerender } = render(
      <TransactionProvider>
        <WalletProvider>
          <TestComponent />
        </WalletProvider>
      </TransactionProvider>
    );

    // Wait for the provider to finish rehydration and reach connected state
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Re-render to get updated context after rehydration
    rerender(
      <TransactionProvider>
        <WalletProvider>
          <TestComponent />
        </WalletProvider>
      </TransactionProvider>
    );

    // Verify we're connected before testing disconnect
    const statusEl = screen.getByTestId('status');
    expect(statusEl.textContent).toBe('connected');

    // 2. Trigger disconnect action
    const btn = screen.getByText('Logout');
    await act(async () => {
      btn.click();
    });

    // 3. Wait for the async disconnect to clear storage
    await waitFor(() => {
      expect(storage.getItem('walletId')).toBeNull();
      expect(storage.getItem('walletAddress')).toBeNull();
    });
  });

  it('should restore session on mount with valid saved credentials', async () => {
    // 1. Set up saved credentials
    storage.setItem('walletId', 'freighter');
    storage.setItem('walletAddress', 'GABC123');

    const TestComponent = () => {
      const context = React.useContext(WalletContext);
      if (!context) return null;
      
      const { address, status } = context;
      return (
        <div>
          <span data-testid="addr">{address}</span>
          <span data-testid="status">{status}</span>
        </div>
      );
    };

    render(
      <TransactionProvider>
        <WalletProvider>
          <TestComponent />
        </WalletProvider>
      </TransactionProvider>
    );

    // Wait for session restoration
    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('connected');
    });

    // Verify address was restored
    expect(screen.getByTestId('addr').textContent).toBe('GABC123');
  });

  it('should handle session restoration when wallet is locked', async () => {
    // Mock getAddress to return no address (simulating locked wallet)
    vi.clearAllMocks();
    vi.mocked(wallet.getAddress).mockResolvedValue({ address: undefined as unknown as string });

    storage.setItem('walletId', 'freighter');
    storage.setItem('walletAddress', 'GABC123');

    const TestComponent = () => {
      const context = React.useContext(WalletContext);
      if (!context) return null;
      
      const { status, error } = context;
      return (
        <div>
          <span data-testid="status">{status}</span>
          <span data-testid="error">{error}</span>
        </div>
      );
    };

    render(
      <TransactionProvider>
        <WalletProvider>
          <TestComponent />
        </WalletProvider>
      </TransactionProvider>
    );

    // Wait for disconnected state due to locked wallet
    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('disconnected');
    });

    // Verify error message
    expect(screen.getByTestId('error').textContent).toContain('locked');
  });

  it('should allow manual reconnection after failed session restoration', async () => {
    // Mock initial failure then success
    vi.clearAllMocks();
    vi.mocked(wallet.getAddress)
      .mockRejectedValueOnce(new Error('Wallet not ready'))
      .mockResolvedValueOnce({ address: 'GABC123' });

    storage.setItem('walletId', 'freighter');
    storage.setItem('walletAddress', 'GABC123');

    const TestComponent = () => {
      const context = React.useContext(WalletContext);
      if (!context) return null;
      
      const { status, address, reconnect } = context;
      return (
        <div>
          <span data-testid="status">{status}</span>
          <span data-testid="addr">{address}</span>
          <button onClick={reconnect} data-testid="reconnect">Reconnect</button>
        </div>
      );
    };

    render(
      <TransactionProvider>
        <WalletProvider>
          <TestComponent />
        </WalletProvider>
      </TransactionProvider>
    );

    // Wait for initial failure
    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('disconnected');
    });

    // Trigger manual reconnection
    const reconnectBtn = screen.getByTestId('reconnect');
    await act(async () => {
      reconnectBtn.click();
    });

    // Wait for successful reconnection
    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('connected');
    });

    expect(screen.getByTestId('addr').textContent).toBe('GABC123');
  });

  it('should prevent reconnection when no wallet ID is saved', async () => {
    const TestComponent = () => {
      const context = React.useContext(WalletContext);
      if (!context) return null;
      
      const { reconnect, status } = context;
      return (
        <div>
          <span data-testid="status">{status}</span>
          <button onClick={reconnect}>Reconnect</button>
        </div>
      );
    };

    render(
      <TransactionProvider>
        <WalletProvider>
          <TestComponent />
        </WalletProvider>
      </TransactionProvider>
    );

    const reconnectBtn = screen.getByText('Reconnect');
    await act(async () => {
      reconnectBtn.click();
    });

    // Status should remain idle (no reconnection attempted)
    expect(screen.getByTestId('status').textContent).toBe('idle');
  });

  it('should handle wallet account change events', async () => {
    storage.setItem('walletId', 'freighter');
    storage.setItem('walletAddress', 'GOLD123');

    const TestComponent = () => {
      const context = React.useContext(WalletContext);
      if (!context) return null;
      
      const { address, status } = context;
      return (
        <div>
          <span data-testid="addr">{address}</span>
          <span data-testid="status">{status}</span>
        </div>
      );
    };

    render(
      <TransactionProvider>
        <WalletProvider>
          <TestComponent />
        </WalletProvider>
      </TransactionProvider>
    );

    // Wait for initial connection
    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('connected');
    });

    // Simulate account change event
    vi.mocked(wallet.getAddress).mockResolvedValue({ address: 'GNEW456' });
    
    act(() => {
      window.dispatchEvent(new CustomEvent('stellar:accountChanged', { 
        detail: { address: 'GNEW456' } 
      }));
    });

    // Wait for reconnection with new address
    await waitFor(() => {
      expect(screen.getByTestId('addr').textContent).toBe('GNEW456');
    });
  });

  it('should reset reconnect attempts on manual disconnect', async () => {
    storage.setItem('walletId', 'freighter');
    storage.setItem('walletAddress', 'GABC123');

    const TestComponent = () => {
      const context = React.useContext(WalletContext);
      if (!context) return null;
      
      const { disconnect, status } = context;
      return (
        <div>
          <span data-testid="status">{status}</span>
          <button onClick={disconnect}>Disconnect</button>
        </div>
      );
    };

    render(
      <TransactionProvider>
        <WalletProvider>
          <TestComponent />
        </WalletProvider>
      </TransactionProvider>
    );

    // Wait for connection
    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('connected');
    });

    // Disconnect
    const disconnectBtn = screen.getByText('Disconnect');
    await act(async () => {
      disconnectBtn.click();
    });

    // Verify storage is cleared
    expect(storage.getItem('walletId')).toBeNull();
    expect(storage.getItem('walletAddress')).toBeNull();
  });
});