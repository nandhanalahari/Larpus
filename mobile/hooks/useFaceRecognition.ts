import { useCallback, useRef } from 'react';
import { api } from '@/services/api';
import { useAppStore, Contact } from '@/store/appStore';
import { FACE_CONFIDENCE_HIGH, FACE_CONFIDENCE_LOW } from '@/constants/thresholds';
import { RECOGNIZE_DEBOUNCE_MS } from '@/constants/timing';

export function useFaceRecognition() {
  const {
    setRecognizedContact,
    clearRecognizedContact,
    setScanStatus,
    selfContactId,
    walletAddress,
  } = useAppStore();

  const requestIdRef = useRef(0);
  const lastCallRef = useRef(0);

  const recognize = useCallback(
    async (imageBase64: string) => {
      const now = Date.now();
      if (now - lastCallRef.current < RECOGNIZE_DEBOUNCE_MS) return;
      lastCallRef.current = now;

      const currentRequestId = ++requestIdRef.current;

      if (!walletAddress) {
        setScanStatus('no_wallet', 'Finish wallet setup');
        return;
      }

      setScanStatus('scanning');

      try {
        const result = await api.recognize(imageBase64, walletAddress);

        if (requestIdRef.current !== currentRequestId) return;

        if (!result.matched) {
          clearRecognizedContact();
          setScanStatus(
            'no_match',
            result.confidence > 0
              ? `No match (score ${result.confidence.toFixed(2)})`
              : 'No face detected',
          );
          return { matched: false as const, confidence: result.confidence };
        }

        if (result.contact.id === selfContactId) {
          clearRecognizedContact();
          setScanStatus('no_match', "That's you — point at someone else");
          return { matched: false as const, isSelf: true };
        }

        const contact: Contact = {
          id: result.contact.id,
          name: result.contact.name,
          phone: result.contact.phone,
          solanaWalletAddress: result.contact.solana_wallet_address,
          lastPayment: result.contact.last_payment
            ? { amountUsd: result.contact.last_payment.amount_usd, paidAt: result.contact.last_payment.paid_at }
            : null,
          pendingDebts: result.contact.pending_debts.map((d) => ({
            debtId: d.debt_id,
            amountUsd: d.amount_usd,
            dueDate: d.due_date,
          })),
          totalOutstandingUsd: result.contact.total_outstanding_usd,
        };

        const requiresConfirmation =
          result.confidence < FACE_CONFIDENCE_HIGH && result.confidence >= FACE_CONFIDENCE_LOW;

        setRecognizedContact(contact, result.confidence, requiresConfirmation);
        setScanStatus('matched', `Identity locked · ${(result.confidence * 100).toFixed(0)}%`);

        return { matched: true as const, contact, confidence: result.confidence, requiresConfirmation };
      } catch (err: any) {
        const msg = String(err?.message ?? err);
        console.warn('[FaceRecognition] recognize failed:', msg);
        if (/Network|fetch|timeout|503/i.test(msg)) {
          setScanStatus('offline', 'Backend offline');
        } else {
          setScanStatus('error', 'Recognition failed');
        }
        return { matched: false as const, error: true };
      }
    },
    [walletAddress, selfContactId, setRecognizedContact, clearRecognizedContact, setScanStatus],
  );

  const reset = useCallback(() => {
    requestIdRef.current++;
    clearRecognizedContact();
    setScanStatus('idle');
  }, [clearRecognizedContact, setScanStatus]);

  return { recognize, reset };
}
