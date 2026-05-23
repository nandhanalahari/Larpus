import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { CipherIcon } from '@/components/ui/CipherIcon';
import { useAppStore } from '@/store/appStore';
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
    // Returning user — wallet already provisioned on device. Skip the
    // wallet + enrollment + first-contact steps and drop them in the app.
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
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandWrap}>
            <View style={styles.logoCircle}>
              <CipherIcon name="lock" size={28} color={theme.colors.tertiary} />
            </View>
            <Text style={styles.brand}>CIPHER</Text>
            <Text style={styles.tagline}>Pay anyone with a glance</Text>
          </View>

          <View style={styles.formWrap}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Your email address</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={theme.colors.onPrimaryContainer}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Choose a password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="min. 8 characters"
                  placeholderTextColor={theme.colors.onPrimaryContainer}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="password-new"
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={10}
                >
                  <MaterialIcons
                    name={showPassword ? 'visibility' : 'visibility-off'}
                    size={20}
                    color={theme.colors.onPrimaryContainer}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.continueBtn,
                canContinue ? styles.continueBtnActive : styles.continueBtnDisabled,
              ]}
              onPress={handleContinue}
              disabled={!canContinue}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.continueText,
                  canContinue ? styles.continueTextActive : styles.continueTextDisabled,
                ]}
              >
                Continue
              </Text>
              <MaterialIcons
                name="chevron-right"
                size={20}
                color={canContinue ? theme.colors.onTertiary : theme.colors.onPrimaryContainer}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchBtn}
              onPress={() => router.replace('/onboarding/signup')}
            >
              <Text style={styles.switchText}>
                Don’t have an account? <Text style={styles.switchLink}>Sign up</Text>
              </Text>
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
    backgroundColor: theme.colors.black,
  },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
    justifyContent: 'space-between',
  },
  brandWrap: {
    alignItems: 'center',
    marginTop: 24,
    gap: 16,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.panelBg,
    borderWidth: 1,
    borderColor: theme.colors.hardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    fontFamily: theme.fonts.mono,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 6,
    color: theme.colors.primary,
  },
  tagline: {
    fontFamily: theme.fonts.mono,
    fontSize: 12,
    letterSpacing: 1.5,
    color: theme.colors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  formWrap: {
    marginTop: 40,
    gap: 20,
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    fontFamily: theme.fonts.mono,
    fontSize: 13,
    color: theme.colors.onSurface,
  },
  input: {
    height: 56,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: theme.colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
    color: theme.colors.primary,
    fontFamily: theme.fonts.mono,
    fontSize: 14,
  },
  passwordRow: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: 52,
  },
  eyeBtn: {
    position: 'absolute',
    right: 18,
    height: 56,
    justifyContent: 'center',
  },
  continueBtn: {
    marginTop: 8,
    height: 56,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  continueBtnActive: {
    backgroundColor: theme.colors.tertiary,
  },
  continueBtnDisabled: {
    backgroundColor: theme.colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
  },
  continueText: {
    fontFamily: theme.fonts.mono,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  continueTextActive: {
    color: theme.colors.onTertiary,
  },
  continueTextDisabled: {
    color: theme.colors.onPrimaryContainer,
  },
  switchBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  switchText: {
    fontFamily: theme.fonts.mono,
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
  },
  switchLink: {
    color: theme.colors.tertiary,
    fontWeight: '700',
  },
});
