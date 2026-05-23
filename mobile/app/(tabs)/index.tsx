import { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useAppStore } from '@/store/appStore';
import { useFaceRecognition } from '@/hooks/useFaceRecognition';
import { useVoice } from '@/hooks/useVoice';
import { useWallet } from '@/hooks/useWallet';
import { FaceOverlay } from '@/components/FaceOverlay';
import { ProfileCard } from '@/components/ProfileCard';
import { VoiceListener } from '@/components/VoiceListener';
import { PaymentStatus } from '@/components/PaymentStatus';
import { solanaService } from '@/services/solana';
import { elevenlabsService } from '@/services/elevenlabs';
import Colors from '@/constants/Colors';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

type UIState = 'scanning' | 'profile' | 'voice' | 'payment_status';

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [uiState, setUIState] = useState<UIState>('scanning');
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
  } = useAppStore();

  const { recognize, reset: resetRecognition } = useFaceRecognition();
  const { isListening, startListening, stopListening, parseTranscript } = useVoice();
  const { canAfford, usdToSol, refreshBalance, fetchSolPrice } = useWallet();
  const { transcript, parsedAmount } = useAppStore();

  useEffect(() => {
    if (!onboardingComplete) {
      router.replace('/onboarding');
    }
  }, [onboardingComplete]);

  useEffect(() => {
    fetchSolPrice();
    if (walletAddress) refreshBalance();
  }, []);

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
          setPaymentResult({ status: 'failed', amountUsd: amount, error: 'Could not get SOL price' });
          return;
        }

        if (!recognizedContact.solanaWalletAddress) {
          setPaymentResult({ status: 'failed', amountUsd: amount, error: 'No wallet address' });
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
          setPaymentResult({ status: 'pending', amountUsd: amount, amountSol });
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
          elevenlabsService.speakLine('paid_confirmation', `$${amount}`, recognizedContact.name);
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

        elevenlabsService.speakLine('paid_confirmation', `$${amount}`, recognizedContact.name);
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
    [recognizedContact, walletAddress, demoMode, solPrice, canAfford, usdToSol, refreshBalance],
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
        <Text style={styles.permText}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permText}>Camera access is needed to scan faces</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing="back">
        <View style={styles.topBar}>
          <Text style={styles.logo}>CIPHER</Text>
          {demoMode && (
            <View style={styles.demoBadge}>
              <Text style={styles.demoText}>DEMO</Text>
            </View>
          )}
        </View>

        {uiState === 'scanning' && (
          <View style={styles.scanHint}>
            <Text style={styles.scanHintText}>
              {recognizedContact ? '' : 'Point at someone to scan'}
            </Text>
          </View>
        )}
      </CameraView>

      {uiState === 'scanning' && recognizedContact && (
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
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  center: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  permText: {
    color: '#aaa',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  permBtn: {
    backgroundColor: Colors.palette.cyan500,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
  },
  permBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  logo: {
    color: Colors.palette.cyan400,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 3,
  },
  demoBadge: {
    backgroundColor: 'rgba(234, 179, 8, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  demoText: {
    color: Colors.palette.yellow400,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  scanHint: {
    position: 'absolute',
    bottom: 140,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  scanHintText: {
    color: '#aaa',
    fontSize: 14,
  },
});
