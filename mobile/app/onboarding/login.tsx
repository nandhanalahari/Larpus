import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAppStore } from '@/store/appStore';
import {
  Headline,
  KolanaField,
  KolanaButton,
} from '@/components/ui/kolana';
import { theme } from '@/constants/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const isValidEmail = /\S+@\S+\.\S+/.test(email.trim());
  const isValidPassword = password.length >= 8;
  const canContinue = isValidEmail && isValidPassword;

  const handleContinue = () => {
    if (!canContinue) return;
    // Returning user — wallet + enrollment already provisioned on device.
    // Skip the wallet + enroll + first-contact steps and drop into the app.
    const { walletAddress, selfEnrolled } = useAppStore.getState();
    if (walletAddress && selfEnrolled) {
      useAppStore.getState().completeOnboarding();
      router.replace('/(tabs)');
      return;
    }
    router.replace('/onboarding/wallet');
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
          <Text style={styles.brand}>KOLANA</Text>

          <Headline title="Welcome back." sub="Sign in to your wallet." />

          <View style={{ gap: 14 }}>
            <KolanaField
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
            />
            <KolanaField
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="password"
              rightIcon={showPassword ? 'visibility' : 'visibility-off'}
              onRightIconPress={() => setShowPassword((v) => !v)}
            />
          </View>

          <TouchableOpacity style={styles.forgotBtn}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          <View style={{ marginTop: 28 }}>
            <KolanaButton
              kind="primary"
              onPress={handleContinue}
              disabled={!canContinue}
            >
              Sign in
            </KolanaButton>
          </View>

          <View style={styles.switchWrap}>
            <Text style={styles.switchText}>New here? </Text>
            <TouchableOpacity onPress={() => router.replace('/onboarding/signup')}>
              <Text style={styles.switchLink}>Create account</Text>
            </TouchableOpacity>
          </View>
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
    paddingTop: 32,
    paddingBottom: 32,
  },
  brand: {
    fontFamily: theme.fonts.display,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 4,
    color: theme.colors.text,
    marginBottom: 56,
  },
  forgotBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  forgotText: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 13,
    color: theme.colors.accent,
  },
  switchWrap: {
    marginTop: 32,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  switchText: {
    fontFamily: theme.fonts.body,
    fontSize: 13,
    color: theme.colors.textDim,
  },
  switchLink: {
    fontFamily: theme.fonts.bodySemibold,
    fontSize: 13,
    color: theme.colors.accent,
  },
});
