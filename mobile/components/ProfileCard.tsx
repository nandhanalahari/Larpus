import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { Contact } from '@/store/appStore';
import { solanaService } from '@/services/solana';
import { KolanaIcon } from '@/components/ui/KolanaIcon';
import { theme } from '@/constants/theme';

type Props = {
  contact: Contact;
  confidence: number;
  requiresConfirmation: boolean;
  onConfirmIdentity: () => void;
  onDeny: () => void;
  onStartPayment: () => void;
  onClose: () => void;
};

export function ProfileCard({
  contact,
  requiresConfirmation,
  onConfirmIdentity,
  onDeny,
  onStartPayment,
  onClose,
}: Props) {
  const wallet = contact.solanaWalletAddress
    ? solanaService.shortenAddress(contact.solanaWalletAddress)
    : 'No wallet linked';

  if (requiresConfirmation) {
    return (
      <Animated.View
        entering={SlideInDown.springify().damping(18)}
        exiting={SlideOutDown.duration(200)}
        style={styles.confirmWrap}
      >
        <View style={styles.confirmCard}>
          <Text style={styles.confirmQuestion}>Is this {contact.name}?</Text>
          <View style={styles.confirmRow}>
            <TouchableOpacity style={styles.confirmYes} onPress={onConfirmIdentity}>
              <Text style={styles.confirmYesText}>Yes</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmNo} onPress={onDeny}>
              <Text style={styles.confirmNoText}>No</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={SlideInDown.springify().damping(18)}
      exiting={SlideOutDown.duration(200)}
      style={styles.wrap}
    >
      <View style={styles.card}>
        <View style={styles.topSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarLetter}>
              {contact.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.identity}>
            <Text style={styles.name}>{contact.name}</Text>
            <Text style={styles.wallet}>{wallet}</Text>
            {contact.lastPayment && (
              <Text style={styles.lastPaid}>
                Last Paid: ${contact.lastPayment.amountUsd.toFixed(0)} (
                {new Date(contact.lastPayment.paidAt).toLocaleDateString()})
              </Text>
            )}
          </View>
        </View>

        {contact.pendingDebts.length > 0 && (
          <View style={styles.debtsBlock}>
            {contact.pendingDebts.map((debt) => (
              <Text key={debt.debtId} style={styles.debtLine}>
                Pending ${debt.amountUsd.toFixed(2)}
              </Text>
            ))}
          </View>
        )}

        <View style={styles.intentSection}>
          <Text style={styles.intentLabel}>Ready to pay</Text>
          <Text style={styles.intentHint}>
            Speak amount after tapping confirm
          </Text>
        </View>

        <View style={styles.actions}>
          {contact.solanaWalletAddress ? (
            <TouchableOpacity style={styles.primaryBtn} onPress={onStartPayment}>
              <KolanaIcon name="fingerprint" size={20} color={theme.colors.onTertiary} />
              <Text style={styles.primaryBtnText}>Start Voice Payment</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.noWallet}>
              <Text style={styles.noWalletText}>No wallet linked</Text>
            </View>
          )}
          <TouchableOpacity style={styles.secondaryBtn} onPress={onClose}>
            <Text style={styles.secondaryBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 88,
    left: theme.spacing.marginMobile,
    right: theme.spacing.marginMobile,
  },
  confirmWrap: {
    position: 'absolute',
    bottom: 88,
    left: theme.spacing.marginMobile,
    right: theme.spacing.marginMobile,
  },
  card: {
    backgroundColor: theme.colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: `${theme.colors.outlineVariant}4D`,
    borderRadius: theme.radius.xl,
    overflow: 'hidden',
  },
  confirmCard: {
    backgroundColor: theme.colors.panelBg,
    borderWidth: 1,
    borderColor: theme.colors.hardBorder,
    padding: 20,
    borderRadius: theme.radius.xl,
  },
  confirmQuestion: {
    color: theme.colors.primary,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 14,
  },
  confirmRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  confirmYes: {
    backgroundColor: theme.colors.tertiary,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 999,
  },
  confirmYesText: {
    color: theme.colors.onTertiary,
    fontFamily: theme.fonts.mono,
    fontWeight: '700',
  },
  confirmNo: {
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: theme.radius.default,
  },
  confirmNoText: {
    color: theme.colors.onSurface,
    fontFamily: theme.fonts.mono,
  },
  topSection: {
    flexDirection: 'row',
    padding: theme.spacing.gutter,
    gap: theme.spacing.gutter,
    borderBottomWidth: 1,
    borderBottomColor: `${theme.colors.outlineVariant}4D`,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: `${theme.colors.outline}33`,
    backgroundColor: theme.colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  identity: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    fontSize: 24,
    fontWeight: '600',
    color: theme.colors.onSurface,
    marginBottom: 4,
  },
  wallet: {
    fontFamily: theme.fonts.mono,
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    opacity: 0.7,
  },
  lastPaid: {
    fontSize: 14,
    color: theme.colors.tertiary,
    marginTop: 6,
  },
  debtsBlock: {
    paddingHorizontal: theme.spacing.gutter,
    paddingTop: 8,
  },
  debtLine: {
    fontFamily: theme.fonts.mono,
    fontSize: 13,
    color: theme.colors.error,
  },
  intentSection: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  intentLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: theme.colors.onSurfaceVariant,
    marginBottom: 8,
  },
  intentHint: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
  },
  actions: {
    padding: theme.spacing.gutter,
    gap: 12,
    backgroundColor: `${theme.colors.surfaceContainer}80`,
  },
  primaryBtn: {
    height: 56,
    backgroundColor: theme.colors.tertiary,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: {
    fontFamily: theme.fonts.mono,
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.onTertiary,
  },
  secondaryBtn: {
    height: 48,
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
    borderRadius: theme.radius.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontFamily: theme.fonts.mono,
    fontSize: 14,
    color: theme.colors.onSurface,
  },
  noWallet: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  noWalletText: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.fonts.mono,
  },
});
