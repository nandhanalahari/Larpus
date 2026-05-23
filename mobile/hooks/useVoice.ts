import { useCallback, useRef, useEffect } from 'react';
import { voiceService } from '@/services/voice';
import { api } from '@/services/api';
import { useAppStore } from '@/store/appStore';
import { MIC_TIMEOUT_MS } from '@/constants/timing';
import { MAX_PAYMENT_USD, MIN_PAYMENT_USD } from '@/constants/thresholds';

type VoiceResult =
  | { intent: 'pay'; amount: number; confidence: number; transcript: string }
  | { intent: 'unclear'; reason: string; transcript: string; fallback?: 'keypad' }
  | { intent: 'invalid'; reason: string; transcript: string; min?: number; max?: number }
  | { intent: 'confirm_large'; amount: number; confidence: number; transcript: string };

export function useVoice() {
  const {
    isListening,
    setListening,
    setTranscript,
    setParsedAmount,
    recognizedContact,
  } = useAppStore();

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopResolverRef = useRef<((result: VoiceResult) => void) | null>(null);

  const finishListening = useCallback(
    async (cancelled: boolean): Promise<VoiceResult> => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setListening(false);

      const uri = await voiceService.stopRecording();

      if (cancelled || !uri) {
        return { intent: 'unclear', reason: cancelled ? 'cancelled' : 'no_audio', transcript: '' };
      }

      try {
        const res = await api.processVoice(uri, recognizedContact?.id);
        setTranscript(res.raw_transcript || '');

        if (res.intent === 'pay') {
          const amount = res.amount_usd;
          if (amount <= 0) {
            return { intent: 'invalid', reason: 'non_positive', transcript: res.raw_transcript };
          }
          if (amount < MIN_PAYMENT_USD) {
            return {
              intent: 'invalid',
              reason: 'too_small',
              min: MIN_PAYMENT_USD,
              transcript: res.raw_transcript,
            };
          }
          if (amount > MAX_PAYMENT_USD) {
            return {
              intent: 'confirm_large',
              amount,
              confidence: res.confidence,
              transcript: res.raw_transcript,
            };
          }
          setParsedAmount(amount);
          return {
            intent: 'pay',
            amount,
            confidence: res.confidence,
            transcript: res.raw_transcript,
          };
        }

        return {
          intent: 'unclear',
          reason: res.reason || 'unclear',
          fallback: res.fallback,
          transcript: res.raw_transcript || '',
        };
      } catch (err) {
        console.warn('[Voice] processVoice failed:', err);
        return {
          intent: 'unclear',
          reason: 'api_error',
          fallback: 'keypad',
          transcript: '',
        };
      }
    },
    [recognizedContact, setListening, setTranscript, setParsedAmount],
  );

  const startListening = useCallback(async () => {
    const hasPermission = await voiceService.requestPermission();
    if (!hasPermission) {
      return { success: false, reason: 'permission_denied' as const };
    }

    setTranscript('');
    setParsedAmount(null);

    const started = await voiceService.startRecording();
    if (!started) {
      return { success: false, reason: 'start_failed' as const };
    }

    setListening(true);

    timeoutRef.current = setTimeout(() => {
      // Auto-stop on timeout. Resolve any pending awaiter so the UI can react.
      finishListening(false).then((res) => stopResolverRef.current?.(res));
    }, MIC_TIMEOUT_MS);

    return { success: true };
  }, [setListening, setTranscript, setParsedAmount, finishListening]);

  const stopListening = useCallback(async (): Promise<VoiceResult> => {
    return finishListening(false);
  }, [finishListening]);

  const cancelListening = useCallback(async () => {
    return finishListening(true);
  }, [finishListening]);

  // Legacy entry point — keep working if anything still calls parseTranscript directly.
  const parseTranscript = useCallback(
    async (transcript: string): Promise<VoiceResult> => {
      if (!transcript.trim()) {
        return { intent: 'unclear', reason: 'empty', transcript };
      }
      if (!recognizedContact) {
        return { intent: 'unclear', reason: 'no_contact', transcript };
      }
      try {
        const result = await api.parseVoice(transcript, recognizedContact.id);
        if (result.intent === 'pay') {
          const amount = result.amount_usd;
          if (amount <= 0) return { intent: 'invalid', reason: 'non_positive', transcript };
          if (amount < MIN_PAYMENT_USD)
            return { intent: 'invalid', reason: 'too_small', min: MIN_PAYMENT_USD, transcript };
          if (amount > MAX_PAYMENT_USD)
            return {
              intent: 'confirm_large',
              amount,
              confidence: result.confidence,
              transcript,
            };
          setParsedAmount(amount);
          return { intent: 'pay', amount, confidence: result.confidence, transcript };
        }
        return { intent: 'unclear', reason: 'unclear', fallback: 'keypad', transcript };
      } catch (err) {
        console.warn('[Voice] parse failed:', err);
        return { intent: 'unclear', reason: 'api_error', fallback: 'keypad', transcript };
      }
    },
    [recognizedContact, setParsedAmount],
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return {
    isListening,
    startListening,
    stopListening,
    cancelListening,
    parseTranscript,
  };
}
