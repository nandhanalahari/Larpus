import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  Headline,
  KolanaField,
  KolanaButton,
  KolanaBackButton,
} from '@/components/ui/kolana';
import { theme } from '@/constants/theme';

export default function SignupScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const isValidName = name.trim().length >= 2;
  const isValidEmail = /\S+@\S+\.\S+/.test(email.trim());
  const isValidPassword = password.length >= 8;
  const canContinue = isValidName && isValidEmail && isValidPassword;

  const handleContinue = () => {
    if (!canContinue) return;
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
          <View style={{ marginBottom: 24 }}>
            <KolanaBackButton onPress={() => router.back()} />
          </View>

          <Headline
            kicker="Sign up"
            title={'Create your\nwallet.'}
            sub="One account · pay anyone with your face."
          />

          <View style={{ gap: 14 }}>
            <KolanaField
              label="Full name"
              value={name}
              onChangeText={setName}
              placeholder="Jane Doe"
              autoCapitalize="words"
              autoComplete="name"
            />
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
              autoComplete="password-new"
              rightIcon={showPassword ? 'visibility' : 'visibility-off'}
              onRightIconPress={() => setShowPassword((v) => !v)}
              hint="At least 8 characters"
            />
          </View>

          <View style={{ marginTop: 28 }}>
            <KolanaButton
              kind="primary"
              onPress={handleContinue}
              disabled={!canContinue}
            >
              Continue
            </KolanaButton>
          </View>

          <Text style={styles.fineprint}>
            By continuing you agree to our Terms & Privacy.
          </Text>
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
  fineprint: {
    marginTop: 16,
    fontFamily: theme.fonts.body,
    fontSize: 11.5,
    color: theme.colors.textFaint,
    textAlign: 'center',
    lineHeight: 18,
  },
});
