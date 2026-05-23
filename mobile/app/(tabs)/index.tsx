import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '@/store/appStore';
import { useFaceRecognition } from '@/hooks/useFaceRecognition';
import { useVoice } from '@/hooks/useVoice';
import { useWallet } from '@/hooks/useWallet';
import { ProfileCard } from '@/components/ProfileCard';
import { VoiceListener } from '@/components/VoiceListener';
import { PaymentStatus } from '@/components/PaymentStatus';
import { ScanReticle } from '@/components/ScanReticle';
import { api } from '@/services/api';
import { elevenlabsService } from '@/services/elevenlabs';
import { theme } from '@/constants/theme';
import { CAMERA_FRAME_INTERVAL_MS } from '@/constants/timing';

type UIState = 'scanning' | 'profile' | 'voice' | 'payment_status';

export default function CameraScreen() {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [uiState, setUIState] = useState<UIState>('scanning');
  const cameraRef = useRef<CameraView>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isScanningRef = useRef(false);
  const [paymentResult, setPaymentResult] = useState<{
    status: 'sending' | 'confirmed' | 'failed' | 'pending' | 'scheduled';
    amountUsd: number;
    amountSol?: number;
    txSignature?: string;
    error?: string;
    dueDate?: string | null;
    note?: string | null;
  } | null>(null);

  const {
    recognizedContact,
    recognitionConfidence,
    requiresConfirmation,
    clearRecognizedContact,
    onboardingComplete,
    demoMode,
    solPrice,
    walletAddress,
    userName,
    transcript,
    parsedAmount,
    parsedDueDate,
    parsedNote,
  } = useAppStore();

  const { recognize, reset: resetRecognition } = useFaceRecognition();
  const { isListening, startListening, stopListening, cancelListening } = useVoice();
  const { canAfford, usdToSol, refreshBalance, fetchSolPrice } = useWallet();

  useEffect(() => {
    if (!onboardingComplete) {
      router.replace('/onboarding');
    }
  }, [onboardingComplete]);

  useEffect(() => {
    fetchSolPrice();
    if (walletAddress) refreshBalance();
  }, []);

  // Auto-flow: face match → either confirmation prompt (low confidence) or straight to voice.
  // High-confidence matches skip the profile-card tap entirely, per PRD F3.
  useEffect(() => {
    if (!recognizedContact || uiState !== 'scanning') return;
    if (requiresConfirmation) {
      setUIState('profile');
    } else {
      setUIState('voice');
    }
  }, [recognizedContact, requiresConfirmation, uiState]);

  const captureAndRecognize = useCallback(async () => {
    if (isScanningRef.current) return;
    if (!cameraRef.current) return;

    isScanningRef.current = true;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.3,
        skipProcessing: true,
      });
      if (photo?.base64) {
        await recognize(photo.base64);
      }
    } catch {
      // camera not ready or frame capture failed -- silently retry next interval
    } finally {
      isScanningRef.current = false;
    }
  }, [recognize]);

  useEffect(() => {
    if (uiState === 'scanning' && !recognizedContact && permission?.granted) {
      scanIntervalRef.current = setInterval(captureAndRecognize, CAMERA_FRAME_INTERVAL_MS);
    } else {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
    }
    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
    };
  }, [uiState, recognizedContact, permission?.granted, captureAndRecognize]);

  const handleStartPayment = useCallback(() => {
    setUIState('voice');
  }, []);

  const handleAmountConfirmed = useCallback(
    async (amount: number, dueDate?: string | null, note?: string | null) => {
      if (!recognizedContact || !walletAddress) return;

      setUIState('payment_status');
      setPaymentResult({ status: 'sending', amountUsd: amount, dueDate, note });

      try {
        const amountSol = usdToSol(amount);
        if (!amountSol) {
          setPaymentResult({
            status: 'failed',
            amountUsd: amount,
            dueDate,
            error: 'Could not get SOL price',
          });
          return;
        }

        if (!recognizedContact.solanaWalletAddress) {
          setPaymentResult({
            status: 'failed',
            amountUsd: amount,
            dueDate,
            error: 'No wallet address',
          });
          return;
        }

        // ── Scheduled payment — due date was spoken ──
        // "pay $20 by Sunday" → save to queue as a scheduled debt, no immediate transfer.
        if (dueDate) {
          useAppStore.getState().addDebt({
            id: `debt-${Date.now()}`,
            contactId: recognizedContact.id,
            contactName: recognizedContact.name,
            amountUsd: amount,
            status: 'scheduled',
            createdAt: new Date().toISOString(),
            dueDate: new Date(dueDate).toISOString(),
          });

          if (recognizedContact.solanaWalletAddress) {
            api
              .createDebt({
                fromUserId: walletAddress,
                toContactId: recognizedContact.id,
                toWallet: recognizedContact.solanaWalletAddress,
                contactName: recognizedContact.name,
                amountUsd: amount,
                dueDate,
              })
              .catch((err) => console.warn('[debt] backend create failed:', err));
          }

          useAppStore.getState().addToQueue(recognizedContact, amount, note ?? undefined);

          setPaymentResult({
            status: 'scheduled',
            amountUsd: amount,
            amountSol,
            dueDate,
          });

          const dueDateFormatted = new Date(dueDate).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          });
          elevenlabsService.speakLine(
            'payment_scheduled',
            `$${amount}`,
            recognizedContact.name,
            dueDateFormatted,
          );
          return;
        }

        if (!canAfford(amount)) {
          useAppStore.getState().addDebt({
            id: `debt-${Date.now()}`,
            contactId: recognizedContact.id,
            contactName: recognizedContact.name,
            amountUsd: amount,
            status: 'pending',
            createdAt: new Date().toISOString(),
            dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
          });
          // Also queue it so the user can retry the whole batch later from the
          // Queue tab once their wallet has been topped up.
          useAppStore
            .getState()
            .addToQueue(recognizedContact, amount, note ?? undefined);
          setPaymentResult({
            status: 'pending',
            amountUsd: amount,
            amountSol,
            dueDate,
          });
          elevenlabsService.speakLine('insufficient_funds');
          return;
        }

        // ── Execute the transfer via the backend ──
        // POST /transactions/transfer atomically:
        //   1. Checks sender has enough in kolana.users ($1000 starting balance)
        //   2. Debits sender, credits receiver in kolana.users
        //   3. Writes to kolana.transactions with from_wallet, to_wallet, amount
        //   4. Mirrors to kolana.ledger → receiver notification fires in ~3 s
        // Uses a KOLANA_ synthetic signature — no Solana devnet call needed.
        console.log(
          `[pay] transferring ${amountSol} SOL to ${recognizedContact.solanaWalletAddress.slice(0, 8)}...`,
        );
        const result = await api.transferFunds({
          fromWallet: walletAddress,
          toWallet: recognizedContact.solanaWalletAddress,
          amountSol,
          amountUsd: amount,
          senderDisplayName: userName ?? null,
          note: note ?? null,
        });
        console.log(`[kolana] transfer confirmed sig=${result.signature.slice(0, 20)}... note=${note ?? 'none'}`);

        setPaymentResult({
          status: 'confirmed',
          amountUsd: amount,
          amountSol,
          txSignature: result.signature,
          dueDate,
          note,
        });

        elevenlabsService.speakLine('paid_confirmation', `$${amount}`, recognizedContact.name);
        refreshBalance();
      } catch (err: any) {
        setPaymentResult({
          status: 'failed',
          amountUsd: amount,
          error: err.message || 'Transaction failed',
          dueDate,
        });
        elevenlabsService.speakLine('tx_failed');
      }
    },
    [
      recognizedContact,
      walletAddress,
      demoMode,
      solPrice,
      userName,
      canAfford,
      usdToSol,
      refreshBalance,
    ],
  );

  useEffect(() => {
    if (parsedAmount !== null && parsedDueDate !== null && recognizedContact && uiState === 'voice') {
      handleAmountConfirmed(parsedAmount, parsedDueDate, parsedNote);
    }
  }, [parsedAmount, parsedDueDate, parsedNote, recognizedContact, uiState, handleAmountConfirmed]);

  const handleDismiss = useCallback(() => {
    setUIState('scanning');
    setPaymentResult(null);
    resetRecognition();
  }, [resetRecognition]);

  const handleClose = useCallback(() => {
    setUIState('scanning');
    clearRecognizedContact();
  }, [clearRecognizedContact]);

  if (!permission) {
    return (
      <View style={styles.center}>
        <Text style={styles.permText}>Requesting camera permission…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permText}>
          Camera access is needed to scan faces
        </Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const showScanChrome =
    uiState === 'scanning' || uiState === 'profile' || uiState === 'voice';

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back">
          {showScanChrome && (
            <View style={styles.overlay} pointerEvents="box-none">
              <View style={[styles.statusWrap, { paddingTop: insets.top + 16 }]}>
                <View style={styles.statusPill}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>
                    {recognizedContact
                      ? 'Identity locked'
                      : 'Biometric Syncing…'}
                  </Text>
                </View>
                {demoMode && (
                  <View style={styles.demoBadge}>
                    <Text style={styles.demoText}>DEMO</Text>
                  </View>
                )}
              </View>

              {uiState !== 'voice' && <ScanReticle />}
            </View>
          )}
        </CameraView>

        {uiState === 'profile' && recognizedContact && (
          <ProfileCard
            contact={recognizedContact}
            confidence={recognitionConfidence}
            requiresConfirmation={requiresConfirmation}
            onConfirmIdentity={() => {
              // Low-confidence match confirmed -> jump straight to voice screen.
              useAppStore.getState().setRecognizedContact(
                recognizedContact,
                recognitionConfidence,
                false,
              );
              setUIState('voice');
            }}
            onDeny={handleClose}
            onStartPayment={handleStartPayment}
            onClose={handleClose}
          />
        )}

        {uiState === 'voice' && recognizedContact && (
          <>
            <View
              pointerEvents="none"
              style={[styles.matchBanner, { top: insets.top + 64 }]}
            >
              <Text style={styles.matchBannerLabel}>Paying</Text>
              <Text style={styles.matchBannerName}>{recognizedContact.name}</Text>
            </View>
            <VoiceListener
              isListening={isListening}
              transcript={transcript}
              parsedAmount={parsedAmount}
              parsedDueDate={parsedDueDate}
              parsedNote={parsedNote}
              contactName={recognizedContact.name}
              onAmountConfirmed={handleAmountConfirmed}
              onStartListening={startListening}
              onStopListening={stopListening}
              onCancel={() => {
                // cancelListening skips the audio upload -- no wasted API call.
                cancelListening();
                handleClose();
              }}
            />
          </>
        )}

        {uiState === 'payment_status' && paymentResult && recognizedContact && (
          <PaymentStatus
            status={paymentResult.status}
            amountUsd={paymentResult.amountUsd}
            amountSol={paymentResult.amountSol}
            contactName={recognizedContact.name}
            txSignature={paymentResult.txSignature}
            dueDate={paymentResult.dueDate}
            note={paymentResult.note}
            error={paymentResult.error}
            onRetry={() => handleAmountConfirmed(paymentResult.amountUsd, paymentResult.dueDate, paymentResult.note)}
            onDismiss={handleDismiss}
          />
        )}
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.black,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  center: {
    flex: 1,
    backgroundColor: theme.colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  permText: {
    color: theme.colors.onSurfaceVariant,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  permBtn: {
    backgroundColor: theme.colors.tertiary,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 999,
  },
  permBtnText: {
    color: theme.colors.onTertiary,
    fontFamily: theme.fonts.mono,
    fontWeight: '700',
    fontSize: 16,
  },
  statusWrap: {
    alignItems: 'center',
    gap: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.panelBg,
    borderWidth: 1,
    borderColor: theme.colors.hardBorder,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.accent,
  },
  statusText: {
    fontFamily: theme.fonts.mono,
    fontSize: 14,
    color: theme.colors.primary,
  },
  demoBadge: {
    backgroundColor: `${theme.colors.error}33`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.default,
  },
  demoText: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.error,
    letterSpacing: 1,
  },
  matchBanner: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: theme.colors.panelBg,
    borderWidth: 1,
    borderColor: theme.colors.hardBorder,
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  matchBannerLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 2,
    color: theme.colors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  matchBannerName: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.primary,
    marginTop: 2,
  },
});
