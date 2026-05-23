import { useCallback, useRef } from 'react';
import { useAppStore, Contact, QueueItem } from '@/store/appStore';
import { solanaService } from '@/services/solana';
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
    addTransaction,
    addDebt,
  } = useAppStore();

  const isExecutingRef = useRef(false);

  const add = useCallback(
    (contact: Contact, amountUsd: number) => {
      addToQueue(contact, amountUsd);
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
        const canPay = await solanaService.canAfford(walletAddress, amountSol);

        if (!canPay) {
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

        const { signature } = await solanaService.sendPayment(
          item.contact.solanaWalletAddress,
          amountSol,
        );

        updateQueueItem(item.id, { status: 'confirmed', txSignature: signature });
        successCount++;
        totalPaidUsd += item.amountUsd;

        addTransaction({
          id: `tx-${Date.now()}`,
          debtId: '',
          contactName: item.contact.name,
          amountUsd: item.amountUsd,
          amountSol,
          solPrice,
          signature,
          status: 'confirmed',
          createdAt: new Date().toISOString(),
          confirmedAt: new Date().toISOString(),
        });
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
  }, [queue, walletAddress, solPrice, updateQueueItem, addTransaction, addDebt]);

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
