import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { useAppStore } from '@/store/appStore';
import { cacheService } from '@/services/cache';
import { elevenlabsService } from '@/services/elevenlabs';
import {
  Headline,
  KolanaField,
  KolanaButton,
  KolanaBackButton,
  StepDots,
} from '@/components/ui/kolana';
import { theme } from '@/constants/theme';

export default function WalletSetup() {
  const storedName = useAppStore((s) => s.userName);
  const [name, setName] = useState(storedName ?? '');
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
      await initWallet(name.trim());
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
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topRow}>
            <KolanaBackButton onPress={() => router.back()} />
            <Text style={styles.stepCount}>1 of 3</Text>
          </View>

          <StepDots step={1} total={3} />

          <Headline
            kicker="Wallet"
            title="Set up your wallet."
            sub={
              <Text style={styles.sub}>
                We'll generate a Solana wallet for you with{' '}
                <Text style={{ color: theme.colors.success, fontFamily: theme.fonts.bodySemibold }}>
                  $1,000
                </Text>{' '}
                in starting balance.
              </Text>
            }
          />

          <View style={{ marginBottom: 24 }}>
            <KolanaField
              label="Your name"
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              autoCapitalize="words"
            />
          </View>

          <KolanaButton
            kind="primary"
            onPress={handleCreate}
            disabled={loading}
          >
            {loading ? 'Creating wallet…' : 'Generate wallet'}
          </KolanaButton>

          <TouchableOpacity style={styles.importBtn}>
            <Text style={styles.importText}>Import existing wallet</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  scroll: {
    flexGrow: 1,
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
  sub: {
    fontFamily: theme.fonts.body,
    fontSize: 14,
    color: theme.colors.textDim,
    lineHeight: 21,
  },
  importBtn: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  importText: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 13,
    color: theme.colors.textDim,
  },
});
