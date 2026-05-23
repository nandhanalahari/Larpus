import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { useState } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { useAppStore } from '@/store/appStore';
import { cacheService } from '@/services/cache';
import { elevenlabsService } from '@/services/elevenlabs';
import Colors from '@/constants/Colors';

export default function WalletSetup() {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const { initWallet } = useWallet();
  const { setOnboardingStep } = useAppStore();

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Enter your name to continue');
      return;
    }

    setLoading(true);
    try {
      const pubKey = await initWallet(name.trim());
      setOnboardingStep('wallet');
      await cacheService.setOnboardingState({
        walletDone: true,
        selfEnrolled: false,
        firstContact: false,
      });
      elevenlabsService.speakLine('welcome');
      router.push('/onboarding/enroll-self');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create wallet');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <View style={styles.step}>
          <Text style={styles.stepLabel}>STEP 1 OF 3</Text>
        </View>

        <Text style={styles.logo}>CIPHER</Text>
        <Text style={styles.tagline}>Point. Speak. Paid.</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Set up your wallet</Text>
          <Text style={styles.cardDesc}>
            We'll create a Solana devnet wallet for you. This is free test money for the demo.
          </Text>

          <Text style={styles.inputLabel}>Your name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Enter your name"
            placeholderTextColor="#555"
            autoCapitalize="words"
            autoFocus
          />
        </View>

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleCreate}
          disabled={loading}
        >
          <Text style={styles.btnText}>
            {loading ? 'Creating wallet...' : 'Create Wallet'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  step: {
    marginBottom: 24,
  },
  stepLabel: {
    color: Colors.palette.cyan400,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
  logo: {
    color: Colors.palette.cyan400,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 6,
    marginBottom: 4,
  },
  tagline: {
    color: '#666',
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: 40,
  },
  card: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 24,
    marginBottom: 32,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  cardDesc: {
    color: '#888',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  inputLabel: {
    color: '#666',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#222',
  },
  btn: {
    backgroundColor: Colors.palette.cyan500,
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
