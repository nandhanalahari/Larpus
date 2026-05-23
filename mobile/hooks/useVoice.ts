import { useCallback, useRef, useEffect } from 'react';
import { voiceService } from '@/services/voice';
import { api } from '@/services/api';
import { useAppStore } from '@/store/appStore';
import { MIC_TIMEOUT_MS } from '@/constants/timing';
import { MAX_PAYMENT_USD, MIN_PAYMENT_USD } from '@/constants/thresholds';

export function useVoice() {
  const {
    isListening,
    setListening,
    setTranscript,
    setParsedAmount,
    recognizedContact,
  } = useAppStore();

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startListening = useCallback(async () => {
    const hasPermission = await voiceService.requestPermission();
    if (!hasPermission) {
      return { success: false, reason: 'permission_denied' as const };
    }

    setTranscript('');
    setParsedAmount(null);
    setListening(true);

    const started = await voiceService.startRecording();
    if (!started) {
      setListening(false);
      return { success: false, reason: 'start_failed' as const };
    }

    timeoutRef.current = setTimeout(() => {
      stopListening();
    }, MIC_TIMEOUT_MS);

    return { success: true };
  }, [setListening, setTranscript, setParsedAmount]);

  const stopListening = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setListening(false);
    const uri = await voiceService.stopRecording();

    return uri;
  }, [setListening]);

  const parseTranscript = useCallback(
    async (transcript: string) => {
      if (!transcript.trim()) {
        return { intent: 'unclear' as const, reason: 'empty' };
      }

      if (!recognizedContact) {
        return { intent: 'unclear' as const, reason: 'no_contact' };
      }

      try {
        const result = await api.parseVoice(transcript, recognizedContact.id);

        if (result.intent === 'pay') {
          if (result.amount_usd <= 0) {
            return { intent: 'invalid' as const, reason: 'non_positive' };
          }
          if (result.amount_usd < MIN_PAYMENT_USD) {
            return { intent: 'invalid' as const, reason: 'too_small', min: MIN_PAYMENT_USD };
          }
          if (result.amount_usd > MAX_PAYMENT_USD) {
            return {
              intent: 'confirm_large' as const,
              amount: result.amount_usd,
              confidence: result.confidence,
            };
          }
          setParsedAmount(result.amount_usd);
          return { intent: 'pay' as const, amount: result.amount_usd, confidence: result.confidence };
        }

        return { intent: 'unclear' as const, fallback: 'keypad' };
      } catch (err) {
        console.warn('[Voice] parse failed:', err);
        return { intent: 'unclear' as const, reason: 'api_error', fallback: 'keypad' };
      }
    },
    [recognizedContact, setParsedAmount],
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return { isListening, startListening, stopListening, parseTranscript };
}
