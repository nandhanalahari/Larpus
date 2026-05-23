import { useCallback, useRef } from 'react';
import { useAppStore, Contact, QueueItem } from '@/store/appStore';
import { api } from '@/services/api';
import { elevenlabsService } from '@/services/elevenlabs';
import { cacheService } from '@/services/cache';
import { FEE_BUFFER_SOL } from '@/constants/thresholds';
import { QUEUE_ITEM_DELAY_MS } from '@/constants/timing';

export function useQueue() {
  const {
    queue,
    addToQueue,
    updateQueueItem,
    clearQueue,
    removeFromQueue,
    walletAddress,
    walletBalanceSol,
    solPrice,
    userName,
    addDebt,
    setWalletBalance,
  } = useAppStore();

  const isExecutingRef = useRef(false);

  const add = useCallback(
    (contact: Contact, amountUsd: number, note?: string | null) => {
      addToQueue(contact, amountUsd, note);
      elevenlabsService.speakLine('queue_added', `$${amountUsd}`, contact.name);
    },
    [addToQueue],
  );

  const totalUsd = queue.reduce((sum, item) => sum + item.amountUsd, 0);
  const totalSol = solPrice ? totalUsd / solPrice : 0;
  const canAffordAll = walletBalanceSol >= totalSol + FEE_BUFFER_SOL * queue.length;

  const executeAll = useCallback(async () => {
    if (isExecutingRef.current) return;
    if (!walletAddress || !solPrice) return;

    isExecutingRef.current = true;
    await cacheService.saveQueueState(queue);

    let successCount = 0;
    let totalPaidUsd = 0;

    for (const item of queue) {
      if (item.status !== 'waiting') continue;

      updateQueueItem(item.id, { status: 'sending' });

      try {
        if (!item.contact.solanaWalletAddress) {
          updateQueueItem(item.id, { status: 'failed', error: 'No wallet address' });
          continue;
        }

        const amountSol = item.amountUsd / solPrice;

        // Use the kolana.users MongoDB balance — the $1000 starting balance
        // is the source of truth, not the Solana devnet balance.
        if (walletBalanceSol < amountSol + FEE_BUFFER_SOL) {
          updateQueueItem(item.id, { status: 'failed', error: 'Insufficient balance' });
          addDebt({
            id: `debt-${Date.now()}`,
            contactId: item.contact.id,
            contactName: item.contact.name,
            amountUsd: item.amountUsd,
            status: 'pending',
            createdAt: new Date().toISOString(),
            dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
          });
          continue;
        }

        // Single call: check balance → debit sender → credit receiver →
        // write to kolana.transactions → write to kolana.ledger
        const result = await api.transferFunds({
          fromWallet: walletAddress,
          toWallet: item.contact.solanaWalletAddress,
          amountSol,
          amountUsd: item.amountUsd,
          senderDisplayName: userName ?? null,
          note: item.note ?? null,
        });

        api
          .getWalletBalance(walletAddress)
          .then((account) => setWalletBalance(account.balance_sol))
          .catch((err) => console.warn('[wallet] refresh after queue payment failed:', err));

        updateQueueItem(item.id, { status: 'confirmed', txSignature: result.signature });
        successCount++;
        totalPaidUsd += item.amountUsd;
      } catch (err: any) {
        updateQueueItem(item.id, {
          status: 'failed',
          error: err.message || 'Transaction failed',
        });
      }

      await new Promise((r) => setTimeout(r, QUEUE_ITEM_DELAY_MS));
    }

    await cacheService.clearQueueState();
    isExecutingRef.current = false;

    if (successCount > 0) {
      elevenlabsService.speakLine(
        'queue_complete',
        `$${totalPaidUsd}`,
        String(successCount),
      );
    }

    return { successCount, totalPaidUsd };
  }, [queue, walletAddress, solPrice, userName, updateQueueItem, addDebt, setWalletBalance]);

  return {
    queue,
    add,
    remove: removeFromQueue,
    clear: clearQueue,
    executeAll,
    totalUsd,
    totalSol,
    canAffordAll,
    isExecuting: isExecutingRef.current,
  };
}
