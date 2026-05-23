import { useCallback } from 'react';
import { solanaService } from '@/services/solana';
import { api } from '@/services/api';
import { useAppStore } from '@/store/appStore';
import { FEE_BUFFER_SOL } from '@/constants/thresholds';
import { PRICE_STALENESS_LIMIT_MS } from '@/constants/timing';
import { cacheService } from '@/services/cache';

export function useWallet() {
  const {
    walletAddress,
    walletBalanceSol,
    solPrice,
    solPriceFetchedAt,
    setUser,
    setWalletBalance,
    setSolPrice,
  } = useAppStore();

  const initWallet = useCallback(async (name: string) => {
    const { publicKey } = await solanaService.createWallet();
    setUser(name, publicKey);
    const balance = await solanaService.getBalance(publicKey).catch(() => 0);
    setWalletBalance(balance);
    return publicKey;
  }, [setUser, setWalletBalance]);

  const refreshBalance = useCallback(async () => {
    if (!walletAddress) return 0;
    const balance = await solanaService.getBalance(walletAddress);
    setWalletBalance(balance);
    return balance;
  }, [walletAddress, setWalletBalance]);

  const fetchSolPrice = useCallback(async () => {
    try {
      const data = await api.getSolPrice();
      setSolPrice(data.sol_usd);
      await cacheService.cacheSolPrice(data.sol_usd);
      return { price: data.sol_usd, stale: false };
    } catch {
      const cached = await cacheService.getCachedSolPrice();
      if (cached) {
        const stale = Date.now() - cached.fetchedAt > PRICE_STALENESS_LIMIT_MS;
        setSolPrice(cached.price);
        return { price: cached.price, stale };
      }
      return null;
    }
  }, [setSolPrice]);

  const usdToSol = useCallback(
    (amountUsd: number): number | null => {
      if (!solPrice) return null;
      return amountUsd / solPrice;
    },
    [solPrice],
  );

  const canAfford = useCallback(
    (amountUsd: number): boolean => {
      if (!solPrice) return false;
      const solNeeded = amountUsd / solPrice + FEE_BUFFER_SOL;
      return walletBalanceSol >= solNeeded;
    },
    [solPrice, walletBalanceSol],
  );

  const isPriceStale = useCallback((): boolean => {
    if (!solPriceFetchedAt) return true;
    return Date.now() - solPriceFetchedAt > PRICE_STALENESS_LIMIT_MS;
  }, [solPriceFetchedAt]);

  /** Check SecureStore for an existing wallet and hydrate Zustand. */
  const loadExistingWallet = useCallback(async () => {
    const keypair = await solanaService.getKeypair();
    if (keypair) {
      const publicKey = keypair.publicKey.toBase58();
      const currentName = useAppStore.getState().userName;
      setUser(currentName ?? '', publicKey);
      const balance = await solanaService.getBalance(publicKey).catch(() => 0);
      setWalletBalance(balance);
      return publicKey;
    }
    return null;
  }, [setUser, setWalletBalance]);

  /** Send SOL denominated in USD — fetches live price, converts, fires tx. */
  const send = useCallback(
    async (toAddress: string, amountUsd: number) => {
      const result = await solanaService.sendPaymentUsd(toAddress, amountUsd);
      await refreshBalance();
      return result;
    },
    [refreshBalance],
  );

  /** Import a wallet from a raw secret-key byte array. */
  const importFromSecret = useCallback(
    async (secretKeyArray: number[], name?: string) => {
      const publicKey = await solanaService.importWallet(secretKeyArray);
      setUser(name ?? useAppStore.getState().userName ?? '', publicKey);
      const balance = await solanaService.getBalance(publicKey).catch(() => 0);
      setWalletBalance(balance);
      return publicKey;
    },
    [setUser, setWalletBalance],
  );

  return {
    walletAddress,
    walletBalanceSol,
    solPrice,
    initWallet,
    refreshBalance,
    fetchSolPrice,
    usdToSol,
    canAfford,
    isPriceStale,
    loadExistingWallet,
    send,
    importFromSecret,
  };
}
