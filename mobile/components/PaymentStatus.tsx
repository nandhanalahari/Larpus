import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import Colors from '@/constants/Colors';

type Props = {
  status: 'sending' | 'confirmed' | 'failed' | 'pending';
  amountUsd: number;
  amountSol?: number;
  contactName: string;
  txSignature?: string;
  error?: string;
  onRetry?: () => void;
  onDismiss: () => void;
};

export function PaymentStatus({
  status,
  amountUsd,
  amountSol,
  contactName,
  txSignature,
  error,
  onRetry,
  onDismiss,
}: Props) {
  const config = {
    sending: { bg: 'rgba(6, 182, 212, 0.1)', color: Colors.palette.cyan400, icon: '...' },
    confirmed: { bg: 'rgba(34, 197, 94, 0.1)', color: Colors.palette.green400, icon: '\u2713' },
    failed: { bg: 'rgba(239, 68, 68, 0.1)', color: Colors.palette.red400, icon: '\u2717' },
    pending: { bg: 'rgba(234, 179, 8, 0.1)', color: Colors.palette.yellow400, icon: '\u23F0' },
  }[status];

  return (
    <Animated.View
      entering={FadeIn}
      exiting={FadeOut}
      style={[styles.container, { backgroundColor: config.bg }]}
    >
      <View style={[styles.iconCircle, { borderColor: config.color }]}>
        <Text style={[styles.icon, { color: config.color }]}>{config.icon}</Text>
      </View>

      <Text style={[styles.statusText, { color: config.color }]}>
        {status === 'sending' && 'Sending...'}
        {status === 'confirmed' && 'Paid'}
        {status === 'failed' && 'Failed'}
        {status === 'pending' && 'Saved for later'}
      </Text>

      <Text style={styles.amount}>${amountUsd.toFixed(2)}</Text>
      {amountSol !== undefined && (
        <Text style={styles.sol}>~{amountSol.toFixed(4)} SOL</Text>
      )}
      <Text style={styles.to}>to {contactName}</Text>

      {txSignature && (
        <Text style={styles.sig}>
          tx: {txSignature.slice(0, 8)}...{txSignature.slice(-8)}
        </Text>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.actions}>
        {status === 'failed' && onRetry && (
          <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss}>
          <Text style={styles.dismissText}>
            {status === 'sending' ? '' : 'Done'}
          </Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 28,
    paddingBottom: 44,
    alignItems: 'center',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  icon: {
    fontSize: 24,
    fontWeight: '700',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  amount: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '800',
  },
  sol: {
    color: '#888',
    fontSize: 14,
    marginTop: 4,
  },
  to: {
    color: '#888',
    fontSize: 15,
    marginTop: 6,
    marginBottom: 8,
  },
  sig: {
    color: '#555',
    fontSize: 11,
    fontFamily: 'SpaceMono',
    marginTop: 4,
  },
  error: {
    color: Colors.palette.red400,
    fontSize: 13,
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  retryBtn: {
    backgroundColor: Colors.palette.cyan500,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
  },
  retryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  dismissBtn: {
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  dismissText: {
    color: '#888',
    fontSize: 15,
  },
});
