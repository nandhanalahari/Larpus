import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { CipherIcon } from '@/components/ui/CipherIcon';
import { theme } from '@/constants/theme';

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
  const isSuccess = status === 'confirmed';
  const solDisplay = amountSol?.toFixed(2) ?? (amountUsd / 150).toFixed(2);

  return (
    <Animated.View
      entering={FadeIn}
      exiting={FadeOut}
      style={styles.overlay}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.iconRing}>
            <CipherIcon
              name={isSuccess ? 'check' : status === 'failed' ? 'close' : 'hourglass-empty'}
              size={40}
              color={theme.colors.tertiary}
            />
          </View>
          <Text style={styles.amountHero}>
            {isSuccess ? '+ ' : ''}
            {solDisplay} SOL
          </Text>
          <Text style={styles.statusLabel}>
            {status === 'sending' && 'Sending…'}
            {status === 'confirmed' && 'Confirmed'}
            {status === 'failed' && 'Failed'}
            {status === 'pending' && 'Saved for later'}
          </Text>
          <Text style={styles.subTo}>
            ${amountUsd.toFixed(2)} to {contactName}
          </Text>
        </View>

        {txSignature && (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.tableHeaderText}>Transaction Details</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.rowLabel}>Network Fee</Text>
              <Text style={styles.rowValue}>0.000005 SOL</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.rowLabel}>Timestamp</Text>
              <Text style={styles.rowValue}>
                {new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC
              </Text>
            </View>
            <View style={[styles.tableRow, styles.tableRowLast]}>
              <Text style={styles.rowLabel}>Signature</Text>
              <Text style={styles.rowValue} numberOfLines={1}>
                {txSignature.slice(0, 16)}…
              </Text>
            </View>
          </View>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.actions}>
          {status === 'failed' && onRetry && (
            <TouchableOpacity style={styles.primaryBtn} onPress={onRetry}>
              <Text style={styles.primaryBtnText}>Retry</Text>
            </TouchableOpacity>
          )}
          {status !== 'sending' && (
            <TouchableOpacity style={styles.returnBtn} onPress={onDismiss}>
              <CipherIcon name="arrow-back" size={18} color={theme.colors.primary} />
              <Text style={styles.returnText}>Return to Scan</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.black,
    zIndex: 20,
  },
  scroll: {
    paddingHorizontal: theme.spacing.marginMobile,
    paddingTop: 48,
    paddingBottom: 120,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: 32,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outlineVariant,
    marginBottom: 24,
  },
  iconRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: theme.colors.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    backgroundColor: theme.colors.surfaceContainerLowest,
  },
  amountHero: {
    fontSize: 48,
    fontWeight: '700',
    color: theme.colors.primary,
    letterSpacing: -1,
    marginBottom: 8,
  },
  statusLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 14,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: theme.colors.tertiary,
    marginBottom: 8,
  },
  subTo: {
    fontFamily: theme.fonts.mono,
    fontSize: 13,
    color: theme.colors.onSurfaceVariant,
  },
  table: {
    borderWidth: 1,
    borderColor: theme.colors.hardBorder,
    backgroundColor: theme.colors.surfaceContainerLowest,
    borderRadius: theme.radius.default,
    overflow: 'hidden',
    marginBottom: 24,
  },
  tableHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.panelBg,
    backgroundColor: theme.colors.panelBg,
  },
  tableHeaderText: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: theme.colors.onSurfaceVariant,
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.panelBg,
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  rowLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
  },
  rowValue: {
    fontFamily: theme.fonts.mono,
    fontSize: 14,
    color: theme.colors.primary,
    maxWidth: '55%',
  },
  error: {
    color: theme.colors.error,
    fontFamily: theme.fonts.mono,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  actions: {
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: theme.colors.tertiary,
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontFamily: theme.fonts.mono,
    fontWeight: '700',
    color: theme.colors.onTertiary,
  },
  returnBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: theme.colors.hardBorder,
    borderRadius: theme.radius.default,
  },
  returnText: {
    fontFamily: theme.fonts.mono,
    fontSize: 14,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: theme.colors.primary,
  },
});
