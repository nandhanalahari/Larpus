import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppStore } from '@/store/appStore';
import { api } from '@/services/api';
import { elevenlabsService } from '@/services/elevenlabs';

export type IncomingPayment = {
  kind: 'transfer' | 'debt_request';
  signature: string;
  fromWallet: string;
  senderName: string | null;
  amountSol: number;
  amountUsd: number | null;
  blockTime: number;
  explorerUrl: string;
};

const POLL_MS = 3000;
const SEEN_STORAGE_PREFIX = '@cipher:incoming_seen:';
const LAST_TS_STORAGE_PREFIX = '@cipher:incoming_last_ts:';
const MAX_SEEN_RETAINED = 200;
// On a fresh launch, deposits older than this are considered "background history"
// and won't trigger a popup. Anything newer than this WILL pop, even if the app
// was closed when it arrived.
const FRESH_LOOKBACK_SECONDS = 5 * 60;

type Persisted = {
  signatures: string[];
  lastBlockTime: number; // unix seconds
};

async function loadPersisted(wallet: string): Promise<Persisted> {
  try {
    const [seenRaw, tsRaw] = await Promise.all([
      AsyncStorage.getItem(SEEN_STORAGE_PREFIX + wallet),
      AsyncStorage.getItem(LAST_TS_STORAGE_PREFIX + wallet),
    ]);
    const signatures = seenRaw ? (JSON.parse(seenRaw) as string[]) : [];
    const lastBlockTime = tsRaw ? Number(tsRaw) : 0;
    return { signatures, lastBlockTime: Number.isFinite(lastBlockTime) ? lastBlockTime : 0 };
  } catch {
    return { signatures: [], lastBlockTime: 0 };
  }
}

async function persistSeen(wallet: string, sigs: Set<string>, lastBlockTime: number) {
  try {
    const arr = Array.from(sigs).slice(-MAX_SEEN_RETAINED);
    await Promise.all([
      AsyncStorage.setItem(SEEN_STORAGE_PREFIX + wallet, JSON.stringify(arr)),
      AsyncStorage.setItem(LAST_TS_STORAGE_PREFIX + wallet, String(lastBlockTime)),
    ]);
  } catch (err) {
    console.warn('[incoming] persist failed:', err);
  }
}

/**
 * Polls the backend for new incoming transfers and surfaces popup toasts.
 *
 * Persists `seen signatures` + `lastBlockTime` to AsyncStorage so:
 *   - Each deposit only pops once across app restarts.
 *   - Deposits that arrived while the app was closed (within the last
 *     FRESH_LOOKBACK_SECONDS) still surface as popups when reopened.
 *   - Old history never floods the user on first launch.
 */
export function useIncomingPayments() {
  const walletAddress = useAppStore((s) => s.walletAddress);
  const onboardingComplete = useAppStore((s) => s.onboardingComplete);
  const setWalletBalance = useAppStore((s) => s.setWalletBalance);

  const [activePayment, setActivePayment] = useState<IncomingPayment | null>(null);
  const activeRef = useRef<IncomingPayment | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const lastBlockTimeRef = useRef<number>(0);
  const queueRef = useRef<IncomingPayment[]>([]);
  const hydratedRef = useRef(false);
  const firstPollRef = useRef(true);

  const showNext = useCallback(() => {
    if (activeRef.current || queueRef.current.length === 0) return;
    const next = queueRef.current.shift()!;
    activeRef.current = next;
    setActivePayment(next);
    elevenlabsService
      .speakLine(
        'deposit_received',
        `${next.amountSol.toFixed(4)} SOL`,
        next.senderName ?? 'someone',
      )
      .catch(() => {});
  }, []);

  const dismissActive = useCallback(() => {
    activeRef.current = null;
    setActivePayment(null);
    setTimeout(showNext, 350);
  }, [showNext]);

  const enqueue = useCallback(
    (items: IncomingPayment[]) => {
      if (!walletAddress) return;
      const fresh = items.filter((it) => !seenRef.current.has(it.signature));
      if (fresh.length === 0) return;

      // Newest last so the most recent deposit shows on top of the queue.
      fresh.sort((a, b) => a.blockTime - b.blockTime);

      let newLast = lastBlockTimeRef.current;
      for (const it of fresh) {
        seenRef.current.add(it.signature);
        queueRef.current.push(it);
        if (it.blockTime > newLast) newLast = it.blockTime;
      }
      lastBlockTimeRef.current = newLast;
      void persistSeen(walletAddress, seenRef.current, newLast);
      showNext();
    },
    [walletAddress, showNext],
  );

  const poll = useCallback(async () => {
    if (!walletAddress || !onboardingComplete || !hydratedRef.current) return;
    try {
      const exclude = Array.from(seenRef.current).join(',');
      const [paymentsRes, debtsRes] = await Promise.allSettled([
        api.pollIncomingPayments(walletAddress, exclude, true),
        api.getUserDebts(walletAddress),
      ]);

      const incoming: IncomingPayment[] = [];

      if (paymentsRes.status === 'fulfilled') {
        const res = paymentsRes.value;
        console.log(
          `[incoming] poll wallet=${walletAddress.slice(0, 6)}… payments=${res.payments.length} synced=${res.synced}`,
        );
        for (const p of res.payments) {
          incoming.push({
            kind: 'transfer',
            signature: p.signature,
            fromWallet: p.from_wallet,
            senderName: p.sender_name,
            amountSol: p.amount_sol,
            amountUsd: p.amount_usd,
            blockTime: p.block_time,
            explorerUrl: p.explorer_url,
          });
        }
      } else {
        console.warn('[incoming] payments poll failed:', paymentsRes.reason);
      }

      if (debtsRes.status === 'fulfilled') {
        const owedToMe = debtsRes.value.owed_to_me ?? [];
        for (const d of owedToMe) {
          if (d.status !== 'pending' && d.status !== 'scheduled') continue;
          const key = `debt:${d.debt_id}`;
          incoming.push({
            kind: 'debt_request',
            signature: key,
            fromWallet: d.from_user_id,
            senderName: d.counterparty_name,
            amountSol: 0,
            amountUsd: d.amount_usd,
            blockTime: Math.floor(new Date(d.created_at).getTime() / 1000),
            explorerUrl: '',
          });
        }
      } else {
        console.warn('[incoming] debts poll failed:', debtsRes.reason);
      }
      if (incoming.length > 0 || (paymentsRes.status === 'fulfilled' && paymentsRes.value.synced > 0)) {
        api
          .getWalletBalance(walletAddress)
          .then((account) => setWalletBalance(account.balance_sol))
          .catch((err) => console.warn('[wallet] refresh after incoming failed:', err));
      }

      if (firstPollRef.current) {
        firstPollRef.current = false;
        const nowSec = Math.floor(Date.now() / 1000);
        const cutoff = Math.max(
          lastBlockTimeRef.current,
          nowSec - FRESH_LOOKBACK_SECONDS,
        );
        const popThese = incoming.filter((p) => p.blockTime > cutoff);
        const justSeen = incoming.filter((p) => p.blockTime <= cutoff);

        // Anything older than the cutoff: mark as seen silently so we don't ever pop it.
        let newLast = lastBlockTimeRef.current;
        for (const p of justSeen) {
          seenRef.current.add(p.signature);
          if (p.blockTime > newLast) newLast = p.blockTime;
        }
        lastBlockTimeRef.current = newLast;
        void persistSeen(walletAddress, seenRef.current, newLast);

        if (popThese.length > 0) enqueue(popThese);
        return;
      }

      enqueue(incoming);
    } catch (err) {
      console.warn('[incoming] poll failed:', err);
    }
  }, [walletAddress, onboardingComplete, enqueue, setWalletBalance]);

  // Hydrate persisted seen-set whenever the active wallet changes.
  useEffect(() => {
    let cancelled = false;
    hydratedRef.current = false;
    firstPollRef.current = true;
    seenRef.current = new Set();
    lastBlockTimeRef.current = 0;
    queueRef.current = [];
    activeRef.current = null;
    setActivePayment(null);

    if (!walletAddress) return;

    (async () => {
      const persisted = await loadPersisted(walletAddress);
      if (cancelled) return;
      seenRef.current = new Set(persisted.signatures);
      lastBlockTimeRef.current = persisted.lastBlockTime;
      hydratedRef.current = true;
      poll();
    })();

    return () => {
      cancelled = true;
    };
  }, [walletAddress, poll]);

  // Interval polling + foreground refresh.
  useEffect(() => {
    if (!walletAddress || !onboardingComplete) return;

    const interval = setInterval(poll, POLL_MS);
    const onAppState = (state: AppStateStatus) => {
      if (state === 'active') poll();
    };
    const sub = AppState.addEventListener('change', onAppState);

    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [walletAddress, onboardingComplete, poll]);

  return { activePayment, dismissActive };
}
