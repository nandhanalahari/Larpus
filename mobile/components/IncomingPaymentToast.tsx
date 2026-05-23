import { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Pressable } from 'react-native';
import Animated, {
  FadeInDown,
  FadeOutUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '@/constants/theme';
import { IncomingPayment } from '@/hooks/useIncomingPayments';
import { solanaService } from '@/services/solana';

type Props = {
  payment: IncomingPayment;
  onDismiss: () => void;
};

const TOAST_TTL_MS = 7000;

export function IncomingPaymentToast({ payment, onDismiss }: Props) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800, easing: Easing.out(Easing.ease) }),
        withTiming(0, { duration: 800, easing: Easing.in(Easing.ease) }),
      ),
      -1,
      true,
    );
    const timer = setTimeout(onDismiss, TOAST_TTL_MS);
    return () => clearTimeout(timer);
  }, [onDismiss, payment.signature, pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + pulse.value * 0.5,
    transform: [{ scale: 1 + pulse.value * 0.12 }],
  }));

  const senderLabel =
    payment.senderName ??
    (payment.fromWallet
      ? solanaService.shortenAddress(payment.fromWallet)
      : 'Someone');

  const isDebt = payment.kind === 'debt_request';
  const eyebrowText = isDebt ? 'Payment requested' : 'Deposit received';
  const iconName = isDebt ? 'receipt-long' : 'south-west';
  const amountLine = isDebt
    ? `$${(payment.amountUsd ?? 0).toFixed(2)} requested`
    : `+${payment.amountSol.toFixed(4)} SOL`;
  const subLine = isDebt
    ? `${senderLabel} scheduled a payment to you`
    : `from ${senderLabel}${payment.amountUsd != null ? ` · $${payment.amountUsd.toFixed(2)}` : ''}`;

  const onPress = () => {
    if (payment.explorerUrl) Linking.openURL(payment.explorerUrl);
  };

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(16).mass(0.6)}
      exiting={FadeOutUp.duration(220)}
      style={styles.wrap}
    >
      <Pressable
        style={styles.card}
        onPress={onPress}
        android_ripple={{ color: 'rgba(0, 227, 139, 0.12)' }}
      >
        <View style={styles.iconWrap}>
          <Animated.View style={[styles.iconRingPulse, ringStyle]} />
          <View style={styles.iconRing}>
            <MaterialIcons name={iconName} size={26} color={theme.colors.tertiary} />
          </View>
        </View>
        <View style={styles.body}>
          <View style={styles.headerRow}>
            <Text style={styles.eyebrow}>{eyebrowText}</Text>
            <View style={styles.liveDotWrap}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          </View>
          <Text style={styles.amount}>{amountLine}</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {subLine}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onDismiss}
          hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
          style={styles.close}
        >
          <MaterialIcons name="close" size={18} color={theme.colors.onSurfaceVariant} />
        </TouchableOpacity>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: theme.colors.panelBg,
    borderWidth: 1.5,
    borderColor: theme.colors.tertiary,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: theme.radius.xl,
    shadowColor: theme.colors.tertiary,
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 18,
  },
  iconWrap: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconRingPulse: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.tertiary,
    opacity: 0.25,
  },
  iconRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: theme.colors.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  body: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: theme.colors.tertiary,
  },
  liveDotWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: `${theme.colors.tertiary}1a`,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.tertiary,
  },
  liveText: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    color: theme.colors.tertiary,
  },
  amount: {
    fontFamily: theme.fonts.mono,
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.primary,
    marginTop: 4,
  },
  sub: {
    fontFamily: theme.fonts.mono,
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    marginTop: 4,
  },
  close: {
    padding: 4,
  },
});
