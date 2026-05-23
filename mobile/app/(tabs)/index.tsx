import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
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
import { solanaService } from '@/services/solana';
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
    status: 'sending' | 'confirmed' | 'failed' | 'pending';
    amountUsd: number;
    amountSol?: number;
    txSignature?: string;
    error?: string;
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
    transcript,
    parsedAmount,
    scanStatus,
    scanMessage,
  } = useAppStore();

  const { recognize, reset: resetRecognition } = useFaceRecognition();
  const { isListening, startListening, stopListening } = useVoice();
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

  useEffect(() => {
    if (recognizedContact && uiState === 'scanning') {
      setUIState('profile');
    }
  }, [recognizedContact]);

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
    startListening();
  }, [startListening]);

  const handleAmountConfirmed = useCallback(
    async (amount: number) => {
      if (!recognizedContact || !walletAddress) return;

      setUIState('payment_status');
      setPaymentResult({ status: 'sending', amountUsd: amount });

      try {
        const amountSol = usdToSol(amount);
        if (!amountSol) {
          setPaymentResult({
            status: 'failed',
            amountUsd: amount,
            error: 'Could not get SOL price',
          });
          return;
        }

        if (!recognizedContact.solanaWalletAddress) {
          setPaymentResult({
            status: 'failed',
            amountUsd: amount,
            error: 'No wallet address',
          });
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
          setPaymentResult({
            status: 'pending',
            amountUsd: amount,
            amountSol,
          });
          elevenlabsService.speakLine('insufficient_funds');
          return;
        }

        if (demoMode) {
          const fakeSig = 'DEMO' + Math.random().toString(36).substring(2, 14);
          setPaymentResult({
            status: 'confirmed',
            amountUsd: amount,
            amountSol,
            txSignature: fakeSig,
          });
          elevenlabsService.speakLine(
            'paid_confirmation',
            `$${amount}`,
            recognizedContact.name,
          );
          return;
        }

        const { signature } = await solanaService.sendPayment(
          recognizedContact.solanaWalletAddress,
          amountSol,
        );

        setPaymentResult({
          status: 'confirmed',
          amountUsd: amount,
          amountSol,
          txSignature: signature,
        });

        useAppStore.getState().addTransaction({
          id: `tx-${Date.now()}`,
          debtId: '',
          contactName: recognizedContact.name,
          amountUsd: amount,
          amountSol,
          solPrice: solPrice!,
          signature,
          status: 'confirmed',
          createdAt: new Date().toISOString(),
          confirmedAt: new Date().toISOString(),
        });

        elevenlabsService.speakLine(
          'paid_confirmation',
          `$${amount}`,
          recognizedContact.name,
        );
        refreshBalance();
      } catch (err: any) {
        setPaymentResult({
          status: 'failed',
          amountUsd: amount,
          error: err.message || 'Transaction failed',
        });
        elevenlabsService.speakLine('tx_failed');
      }
    },
    [
      recognizedContact,
      walletAddress,
      demoMode,
      solPrice,
      canAfford,
      usdToSol,
      refreshBalance,
    ],
  );

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
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back">
        {showScanChrome && (
          <View style={styles.overlay} pointerEvents="box-none">
            <View style={[styles.statusWrap, { paddingTop: insets.top + 16 }]}>
              <View
                style={[
                  styles.statusPill,
                  scanStatus === 'matched' && styles.statusPillMatched,
                  (scanStatus === 'offline' || scanStatus === 'error') && styles.statusPillError,
                  scanStatus === 'no_match' && styles.statusPillWarn,
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    scanStatus === 'matched' && { backgroundColor: theme.colors.success },
                    (scanStatus === 'offline' || scanStatus === 'error') && {
                      backgroundColor: theme.colors.error,
                    },
                    scanStatus === 'no_match' && { backgroundColor: theme.colors.warn ?? theme.colors.accent },
                  ]}
                />
                <Text style={styles.statusText}>{scanMessage}</Text>
              </View>
              {demoMode && (
                <View style={styles.demoBadge}>
                  <Text style={styles.demoText}>DEMO</Text>
                </View>
              )}
              {scanStatus === 'no_match' && uiState === 'scanning' && (
                <TouchableOpacity
                  style={styles.enrollCta}
                  onPress={() => router.push('/enroll')}
                >
                  <Text style={styles.enrollCtaText}>+ Enroll new face</Text>
                </TouchableOpacity>
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
            useAppStore.getState().setRecognizedContact(
              recognizedContact,
              recognitionConfidence,
              false,
            );
          }}
          onDeny={handleClose}
          onStartPayment={handleStartPayment}
          onClose={handleClose}
        />
      )}

      {uiState === 'voice' && recognizedContact && (
        <VoiceListener
          isListening={isListening}
          transcript={transcript}
          parsedAmount={parsedAmount}
          contactName={recognizedContact.name}
          onAmountConfirmed={handleAmountConfirmed}
          onCancel={() => {
            stopListening();
            setUIState('profile');
          }}
        />
      )}

      {uiState === 'payment_status' && paymentResult && recognizedContact && (
        <PaymentStatus
          status={paymentResult.status}
          amountUsd={paymentResult.amountUsd}
          amountSol={paymentResult.amountSol}
          contactName={recognizedContact.name}
          txSignature={paymentResult.txSignature}
          error={paymentResult.error}
          onRetry={() => handleAmountConfirmed(paymentResult.amountUsd)}
          onDismiss={handleDismiss}
        />
      )}
    </View>
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
  statusPillMatched: {
    borderColor: theme.colors.success,
  },
  statusPillError: {
    borderColor: theme.colors.error,
  },
  statusPillWarn: {
    borderColor: theme.colors.warn ?? theme.colors.accent,
  },
  enrollCta: {
    marginTop: 4,
    backgroundColor: theme.colors.panelBg,
    borderWidth: 1,
    borderColor: theme.colors.hardBorder,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  enrollCtaText: {
    fontFamily: theme.fonts.mono,
    fontSize: 12,
    color: theme.colors.primary,
    letterSpacing: 1,
  },
});
