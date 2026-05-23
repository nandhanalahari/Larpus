import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useState, useRef } from 'react';
import { useAppStore } from '@/store/appStore';
import { cacheService } from '@/services/cache';
import Colors from '@/constants/Colors';

const ANGLES = ['Look straight at the camera', 'Turn slightly left', 'Turn slightly right'] as const;

export default function EnrollSelf() {
  const [permission, requestPermission] = useCameraPermissions();
  const [currentAngle, setCurrentAngle] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const { setOnboardingStep, setSelfContactId } = useAppStore();

  const handleCapture = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);

    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.7 });
      if (!photo?.base64) {
        Alert.alert('Error', 'Failed to capture photo');
        setCapturing(false);
        return;
      }

      const newPhotos = [...photos, photo.base64];
      setPhotos(newPhotos);

      if (newPhotos.length < 3) {
        setCurrentAngle(currentAngle + 1);
      } else {
        setOnboardingStep('self');
        setSelfContactId('self-user');
        await cacheService.setOnboardingState({
          walletDone: true,
          selfEnrolled: true,
          firstContact: false,
        });
        router.push('/onboarding/add-first');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Capture failed');
    } finally {
      setCapturing(false);
    }
  };

  if (!permission?.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permText}>Camera access is needed to enroll your face</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.stepLabel}>STEP 2 OF 3</Text>
        <Text style={styles.title}>Enroll your face</Text>
        <Text style={styles.desc}>
          This helps CIPHER recognize you so no one can accidentally pay themselves.
        </Text>
      </View>

      <View style={styles.cameraWrap}>
        <CameraView ref={cameraRef} style={styles.camera} facing="front">
          <View style={styles.cameraOverlay}>
            <View style={styles.faceGuide} />
          </View>
        </CameraView>
      </View>

      <View style={styles.bottom}>
        <Text style={styles.instruction}>{ANGLES[currentAngle]}</Text>

        <View style={styles.progress}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[
                styles.progressDot,
                i < photos.length && styles.progressDotDone,
                i === currentAngle && styles.progressDotActive,
              ]}
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.captureBtn, capturing && styles.btnDisabled]}
          onPress={handleCapture}
          disabled={capturing}
        >
          <View style={styles.captureBtnInner} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
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
  header: {
    paddingTop: 80,
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  stepLabel: {
    color: Colors.palette.cyan400,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 12,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  desc: {
    color: '#888',
    fontSize: 14,
    lineHeight: 20,
  },
  cameraWrap: {
    flex: 1,
    margin: 24,
    borderRadius: 24,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceGuide: {
    width: 220,
    height: 280,
    borderRadius: 110,
    borderWidth: 2,
    borderColor: 'rgba(6, 182, 212, 0.4)',
    borderStyle: 'dashed',
  },
  bottom: {
    paddingHorizontal: 24,
    paddingBottom: 50,
    alignItems: 'center',
  },
  instruction: {
    color: Colors.palette.cyan400,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  progress: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#333',
  },
  progressDotDone: {
    backgroundColor: Colors.palette.green400,
  },
  progressDotActive: {
    backgroundColor: Colors.palette.cyan400,
  },
  captureBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureBtnInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
