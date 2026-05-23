import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useState, useRef } from 'react';
import { useAppStore } from '@/store/appStore';
import { cacheService } from '@/services/cache';
import { api } from '@/services/api';
import {
  Headline,
  KolanaButton,
  KolanaBackButton,
  StepDots,
} from '@/components/ui/kolana';
import { theme } from '@/constants/theme';

const ANGLES = [
  'Look straight at the camera.',
  'Turn slightly to your left.',
  'Turn slightly to your right.',
] as const;

export default function EnrollSelf() {
  const [permission, requestPermission] = useCameraPermissions();
  const [currentAngle, setCurrentAngle] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const { setOnboardingStep, setSelfContactId, userName, walletAddress } =
    useAppStore();

  const enrollOnBackend = async (allPhotos: string[]) => {
    if (!walletAddress) {
      Alert.alert('Wallet missing', 'Go back and complete the wallet step first.');
      return;
    }
    setUploading(true);
    try {
      const res = await api.createContact({
        ownerUserId: walletAddress,
        name: userName ?? 'You',
        phone: null,
        solanaWalletAddress: walletAddress,
        faceImagesBase64: allPhotos,
      });
      setSelfContactId(res.contact_id);
      setOnboardingStep('self');
      await cacheService.setOnboardingState({
        walletDone: true,
        selfEnrolled: true,
        firstContact: false,
      });
      router.push('/onboarding/add-first');
    } catch (err: any) {
      const msg = err?.message ?? 'Upload failed';
      if (msg.includes('No face detected')) {
        Alert.alert(
          'No face detected',
          'One of your photos didn’t have a clear face. Let’s retake all 3.',
          [{ text: 'OK', onPress: () => { setPhotos([]); setCurrentAngle(0); } }],
        );
      } else if (msg.includes('409')) {
        setOnboardingStep('self');
        await cacheService.setOnboardingState({
          walletDone: true,
          selfEnrolled: true,
          firstContact: false,
        });
        router.push('/onboarding/add-first');
      } else {
        Alert.alert('Enrollment failed', msg);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleCapture = async () => {
    if (!cameraRef.current || capturing || uploading) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.7,
      });
      if (!photo?.base64) {
        Alert.alert('Error', 'Failed to capture photo');
        return;
      }
      const newPhotos = [...photos, photo.base64];
      setPhotos(newPhotos);
      if (newPhotos.length < 3) {
        setCurrentAngle(currentAngle + 1);
      } else {
        await enrollOnBackend(newPhotos);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Capture failed');
    } finally {
      setCapturing(false);
    }
  };

  if (!permission?.granted) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <Text style={styles.permText}>
            Camera access is needed to enroll your face
          </Text>
          <KolanaButton kind="primary" onPress={requestPermission}>
            Grant Permission
          </KolanaButton>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.scroll}>
        <View style={styles.topRow}>
          <KolanaBackButton onPress={() => router.back()} />
          <Text style={styles.stepCount}>2 of 3</Text>
        </View>

        <StepDots step={2} total={3} />

        <Headline
          title="Enroll your face."
          sub="Three angles · helps us know it's really you."
        />

        <View style={styles.cameraWrap}>
          <CameraView ref={cameraRef} style={styles.camera} facing="front">
            <View style={styles.cameraOverlay} pointerEvents="none">
              {/* Corner brackets — the only "HUD" touch reserved for scan moments */}
              <Corner pos="tl" />
              <Corner pos="tr" />
              <Corner pos="bl" />
              <Corner pos="br" />
            </View>
          </CameraView>
        </View>

        <Text style={styles.instruction}>
          {uploading ? 'Enrolling on server…' : ANGLES[currentAngle]}
        </Text>

        <View style={styles.dots}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i < photos.length && styles.dotDone,
                i === currentAngle && !uploading && styles.dotActive,
              ]}
            />
          ))}
        </View>

        {uploading ? (
          <ActivityIndicator size="large" color={theme.colors.accent} />
        ) : (
          <KolanaButton
            kind="primary"
            onPress={handleCapture}
            disabled={capturing}
          >
            {currentAngle < 2 ? 'Capture' : 'Capture & finish'}
          </KolanaButton>
        )}
      </View>
    </SafeAreaView>
  );
}

function Corner({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const base = {
    position: 'absolute' as const,
    width: 24,
    height: 24,
    borderColor: '#fff',
    borderStyle: 'solid' as const,
  };
  const inset = 14;
  if (pos === 'tl')
    return (
      <View
        style={[
          base,
          { top: inset, left: inset, borderTopWidth: 1.5, borderLeftWidth: 1.5 },
        ]}
      />
    );
  if (pos === 'tr')
    return (
      <View
        style={[
          base,
          { top: inset, right: inset, borderTopWidth: 1.5, borderRightWidth: 1.5 },
        ]}
      />
    );
  if (pos === 'bl')
    return (
      <View
        style={[
          base,
          { bottom: inset, left: inset, borderBottomWidth: 1.5, borderLeftWidth: 1.5 },
        ]}
      />
    );
  return (
    <View
      style={[
        base,
        { bottom: inset, right: inset, borderBottomWidth: 1.5, borderRightWidth: 1.5 },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: theme.spacing.marginMobile,
    paddingTop: 24,
    paddingBottom: 32,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  stepCount: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 12,
    color: theme.colors.textDim,
  },
  cameraWrap: {
    aspectRatio: 1,
    width: '100%',
    borderRadius: theme.radius.card,
    overflow: 'hidden',
    marginBottom: 22,
    backgroundColor: theme.colors.bgDeep,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  instruction: {
    fontFamily: theme.fonts.body,
    fontSize: 15,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 18,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 22,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(230,240,255,0.16)',
  },
  dotDone: {
    backgroundColor: theme.colors.success,
    width: 24,
  },
  dotActive: {
    backgroundColor: theme.colors.accent,
    width: 24,
  },
  center: {
    flex: 1,
    paddingHorizontal: theme.spacing.marginMobile,
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: 20,
  },
  permText: {
    fontFamily: theme.fonts.body,
    color: theme.colors.textDim,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});
