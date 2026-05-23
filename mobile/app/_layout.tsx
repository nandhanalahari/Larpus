import 'react-native-get-random-values';
import { Buffer } from 'buffer';
(globalThis as any).Buffer = (globalThis as any).Buffer || Buffer;

import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { IncomingPaymentToast } from '@/components/IncomingPaymentToast';
import { useIncomingPayments } from '@/hooks/useIncomingPayments';
import { solanaService } from '@/services/solana';
import { useAppStore } from '@/store/appStore';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  // Reconcile wallet pubkey from SecureStore (source of truth for the keypair)
  // with the persisted Zustand store. Covers the case where someone wipes
  // AsyncStorage but still has the wallet in SecureStore, or vice versa.
  useEffect(() => {
    (async () => {
      try {
        const keypair = await solanaService.getKeypair();
        if (keypair) {
          const pub = keypair.publicKey.toBase58();
          const { walletAddress, userName, setUser } = useAppStore.getState();
          if (walletAddress !== pub) {
            setUser(userName ?? '', pub);
          }
        }
      } catch (err) {
        console.warn('[hydrate] wallet check failed:', err);
      }
    })();
  }, []);

  if (!loaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#141313' },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="onboarding"
          options={{ gestureEnabled: false }}
        />
        <Stack.Screen
          name="enroll"
          options={{ presentation: 'modal' }}
        />
      </Stack>
      <GlobalIncomingToastHost />
    </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

function GlobalIncomingToastHost() {
  const insets = useSafeAreaInsets();
  const { activePayment, dismissActive } = useIncomingPayments();
  if (!activePayment) return null;
  return (
    <View
      style={[styles.toastHost, { top: insets.top + 8 }]}
      pointerEvents="box-none"
    >
      <IncomingPaymentToast payment={activePayment} onDismiss={dismissActive} />
    </View>
  );
}

const styles = StyleSheet.create({
  toastHost: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 24,
  },
});
