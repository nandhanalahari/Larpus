import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useState, useRef } from 'react';
import { ActivityIndicator } from 'react-native';
import { solanaService } from '@/services/solana';
import { elevenlabsService } from '@/services/elevenlabs';
import { api } from '@/services/api';
import { useAppStore } from '@/store/appStore';
import Colors from '@/constants/Colors';

const ANGLES = ['Look straight', 'Slight left', 'Slight right'] as const;

type Step = 'form' | 'photos';

export default function EnrollScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [step, setStep] = useState<Step>('form');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [wallet, setWallet] = useState('');
  const [walletError, setWalletError] = useState('');
  const [angleIndex, setAngleIndex] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const walletAddress = useAppStore((s) => s.walletAddress);

  const handleWalletChange = (text: string) => {
    setWallet(text);
    if (text.length > 0 && !solanaService.validateAddress(text)) {
      setWalletError('Invalid Solana address');
    } else {
      setWalletError('');
    }
  };

  const handleContinueToPhotos = () => {
    if (!name.trim()) {
      Alert.alert('Name required');
      return;
    }
    if (wallet && !solanaService.validateAddress(wallet)) {
      Alert.alert('Invalid wallet address');
      return;
    }
    setStep('photos');
  };

  const uploadContact = async (allPhotos: string[]) => {
    if (!walletAddress) {
      Alert.alert('Not signed in', 'Complete onboarding first.');
      router.back();
      return;
    }
    setUploading(true);
    try {
      const res = await api.createContact({
        ownerUserId: walletAddress,
        name: name.trim(),
        phone: phone.trim() || null,
        solanaWalletAddress: wallet.trim() || null,
        faceImagesBase64: allPhotos,
      });
      Alert.alert(
        'Contact Added',
        `${res.name} enrolled with ${res.embeddings_stored} face embeddings.`,
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (err: any) {
      const msg = err?.message ?? 'Upload failed';
      if (msg.includes('No face detected')) {
        Alert.alert(
          'No face detected',
          'One of the photos didn’t have a clear face. Let’s retake all 3.',
          [{ text: 'OK', onPress: () => { setPhotos([]); setAngleIndex(0); } }],
        );
      } else if (msg.includes('409')) {
        // Parse out the existing contact's name from the API error body.
        // Format: 'API 409: {"detail":"Contact with this wallet already exists: <Name>"}'
        let conflictName = '';
        const match = msg.match(/already exists:\s*([^"}]+)/);
        if (match) conflictName = match[1].trim();
        Alert.alert(
          'Wallet already in use',
          conflictName
            ? `That wallet is already assigned to "${conflictName}". Use a different wallet, or leave the field empty to enroll by face only.`
            : 'That wallet is already assigned to another contact. Use a different one or leave it empty.',
          [{ text: 'OK' }],
        );
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
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.7 });
      if (!photo?.base64) {
        Alert.alert('Capture failed');
        setCapturing(false);
        return;
      }

      const newPhotos = [...photos, photo.base64];
      setPhotos(newPhotos);

      if (newPhotos.length < 3) {
        setAngleIndex(angleIndex + 1);
      } else {
        await uploadContact(newPhotos);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setCapturing(false);
    }
  };

  if (step === 'form') {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.topRow}>
            <Text style={styles.title}>New Contact</Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.inputLabel}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Their name"
            placeholderTextColor="#555"
            autoCapitalize="words"
            autoFocus
          />

          <Text style={styles.inputLabel}>Phone (optional)</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="+1 (555) 123-4567"
            placeholderTextColor="#555"
            keyboardType="phone-pad"
          />

          <Text style={styles.inputLabel}>Solana Wallet Address</Text>
          <TextInput
            style={[styles.input, walletError ? styles.inputError : null]}
            value={wallet}
            onChangeText={handleWalletChange}
            placeholder="Base58 address"
            placeholderTextColor="#555"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {walletError ? <Text style={styles.errorText}>{walletError}</Text> : null}

          <TouchableOpacity style={styles.continueBtn} onPress={handleContinueToPhotos}>
            <Text style={styles.continueBtnText}>Continue to Photos</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (!permission?.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permText}>Camera access needed</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Grant</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.photoHeader}>
        <Text style={styles.title}>Photo {photos.length + 1} of 3</Text>
        <Text style={styles.photoDesc}>{ANGLES[angleIndex]}</Text>
      </View>

      <View style={styles.cameraWrap}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back">
          <View style={styles.cameraOverlay}>
            <View style={styles.faceGuide} />
          </View>
        </CameraView>
      </View>

      <View style={styles.captureSection}>
        <View style={styles.progress}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i < photos.length && styles.dotDone,
                i === angleIndex && !uploading && styles.dotActive,
              ]}
            />
          ))}
        </View>
        {uploading ? (
          <ActivityIndicator size="large" color={Colors.palette.cyan400} />
        ) : (
          <TouchableOpacity
            style={[styles.captureBtn, capturing && styles.btnDisabled]}
            onPress={handleCapture}
            disabled={capturing}
          >
            <View style={styles.captureBtnInner} />
          </TouchableOpacity>
        )}
        {uploading && (
          <Text style={styles.uploadingText}>Enrolling on server…</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 50,
  },
  center: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
  },
  cancelText: {
    color: '#666',
    fontSize: 15,
  },
  inputLabel: {
    color: '#666',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 20,
  },
  input: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#222',
  },
  inputError: {
    borderColor: Colors.palette.red400,
  },
  errorText: {
    color: Colors.palette.red400,
    fontSize: 12,
    marginTop: 4,
  },
  continueBtn: {
    backgroundColor: Colors.palette.cyan500,
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 32,
  },
  continueBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  permText: {
    color: '#aaa',
    fontSize: 16,
    marginBottom: 16,
  },
  permBtn: {
    backgroundColor: Colors.palette.cyan500,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  permBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  photoHeader: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  photoDesc: {
    color: Colors.palette.cyan400,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
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
    width: 200,
    height: 260,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: 'rgba(6, 182, 212, 0.4)',
    borderStyle: 'dashed',
  },
  captureSection: {
    alignItems: 'center',
    paddingBottom: 50,
  },
  progress: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#333',
  },
  dotDone: {
    backgroundColor: Colors.palette.green400,
  },
  dotActive: {
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
  uploadingText: {
    color: Colors.palette.cyan400,
    fontSize: 14,
    marginTop: 12,
  },
});
