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
import { router } from 'expo-router';
import { useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { solanaService } from '@/services/solana';
import { cacheService } from '@/services/cache';
import Colors from '@/constants/Colors';

export default function AddFirstContact() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [wallet, setWallet] = useState('');
  const [walletError, setWalletError] = useState('');
  const { setOnboardingStep, completeOnboarding } = useAppStore();

  const handleWalletChange = (text: string) => {
    setWallet(text);
    if (text.length > 0 && !solanaService.validateAddress(text)) {
      setWalletError('Invalid Solana address');
    } else {
      setWalletError('');
    }
  };

  const handleSkip = async () => {
    setOnboardingStep('contact');
    completeOnboarding();
    await cacheService.setOnboardingState({
      walletDone: true,
      selfEnrolled: true,
      firstContact: true,
    });
    router.replace('/(tabs)');
  };

  const handleAdd = async () => {
    if (!name.trim()) {
      Alert.alert('Name required');
      return;
    }
    if (wallet && !solanaService.validateAddress(wallet)) {
      Alert.alert('Invalid wallet address');
      return;
    }

    setOnboardingStep('contact');
    completeOnboarding();
    await cacheService.setOnboardingState({
      walletDone: true,
      selfEnrolled: true,
      firstContact: true,
    });
    router.replace('/(tabs)');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.stepLabel}>STEP 3 OF 3</Text>
          <Text style={styles.title}>Add your first contact</Text>
          <Text style={styles.desc}>
            Add someone you frequently split bills with. You can also scan their face later from the camera screen.
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.inputLabel}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Their name"
            placeholderTextColor="#555"
            autoCapitalize="words"
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

          <Text style={styles.inputLabel}>Solana Wallet Address (optional)</Text>
          <TextInput
            style={[styles.input, walletError ? styles.inputError : null]}
            value={wallet}
            onChangeText={handleWalletChange}
            placeholder="Base58 address or scan QR later"
            placeholderTextColor="#555"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {walletError ? <Text style={styles.errorText}>{walletError}</Text> : null}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
            <Text style={styles.addBtnText}>Add Contact</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
            <Text style={styles.skipBtnText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 50,
  },
  header: {
    marginBottom: 32,
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
  form: {
    marginBottom: 32,
  },
  inputLabel: {
    color: '#666',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 16,
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
  actions: {
    gap: 12,
  },
  addBtn: {
    backgroundColor: Colors.palette.cyan500,
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
  },
  addBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  skipBtn: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  skipBtnText: {
    color: '#666',
    fontSize: 15,
  },
});
