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
import { theme } from '@/constants/theme';

export default function SignupScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const isValidName = name.trim().length >= 2;
  const isValidEmail = /\S+@\S+\.\S+/.test(email.trim());
  const isValidPassword = password.length >= 8;
  const passwordsMatch = password === confirm && confirm.length > 0;
  const canContinue = isValidName && isValidEmail && isValidPassword && passwordsMatch;

  const handleContinue = () => {
    if (!canContinue) return;
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
            <Text style={styles.tagline}>Create your account</Text>
          </View>

          <View style={styles.formWrap}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Your name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Jane Doe"
                placeholderTextColor={theme.colors.onPrimaryContainer}
                autoCapitalize="words"
                autoComplete="name"
              />
            </View>

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

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Confirm password</Text>
              <TextInput
                style={styles.input}
                value={confirm}
                onChangeText={setConfirm}
                placeholder="re-enter password"
                placeholderTextColor={theme.colors.onPrimaryContainer}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              {confirm.length > 0 && !passwordsMatch && (
                <Text style={styles.errorText}>Passwords don’t match</Text>
              )}
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
                Create account
              </Text>
              <MaterialIcons
                name="chevron-right"
                size={20}
                color={canContinue ? theme.colors.onTertiary : theme.colors.onPrimaryContainer}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchBtn}
              onPress={() => router.replace('/onboarding/login')}
            >
              <Text style={styles.switchText}>
                Already have an account? <Text style={styles.switchLink}>Sign in</Text>
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
  },
  brandWrap: {
    alignItems: 'center',
    marginTop: 12,
    gap: 14,
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
    marginTop: 28,
    gap: 16,
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
  errorText: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    color: theme.colors.error,
    paddingLeft: 8,
  },
  continueBtn: {
    marginTop: 4,
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
