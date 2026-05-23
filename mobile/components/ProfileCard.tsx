import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { Contact } from '@/store/appStore';
import { ConfidenceRing } from './ConfidenceRing';
import { solanaService } from '@/services/solana';
import Colors from '@/constants/Colors';

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
  confidence,
  requiresConfirmation,
  onConfirmIdentity,
  onDeny,
  onStartPayment,
  onClose,
}: Props) {
  const wallet = contact.solanaWalletAddress
    ? solanaService.shortenAddress(contact.solanaWalletAddress)
    : 'No wallet linked';

  return (
    <Animated.View
      entering={SlideInDown.springify().damping(18)}
      exiting={SlideOutDown.duration(200)}
      style={styles.container}
    >
      <View style={styles.handle} />

      {requiresConfirmation ? (
        <View style={styles.confirmBanner}>
          <Text style={styles.confirmText}>Is this {contact.name}?</Text>
          <View style={styles.confirmButtons}>
            <TouchableOpacity style={styles.confirmYes} onPress={onConfirmIdentity}>
              <Text style={styles.confirmBtnText}>Yes</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmNo} onPress={onDeny}>
              <Text style={styles.confirmBtnTextDeny}>No</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <View style={styles.header}>
        <View style={styles.nameRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{contact.name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.nameBlock}>
            <Text style={styles.name}>{contact.name}</Text>
            <Text style={styles.wallet}>{wallet}</Text>
            {contact.phone && <Text style={styles.phone}>{contact.phone}</Text>}
          </View>
          <ConfidenceRing confidence={confidence} size={44} />
        </View>
      </View>

      {contact.lastPayment && (
        <View style={styles.lastPayment}>
          <Text style={styles.label}>Last paid</Text>
          <Text style={styles.value}>
            ${contact.lastPayment.amountUsd.toFixed(2)} &middot;{' '}
            {new Date(contact.lastPayment.paidAt).toLocaleDateString()}
          </Text>
        </View>
      )}

      {contact.pendingDebts.length > 0 && (
        <View style={styles.debtsSection}>
          <Text style={styles.label}>Open debts</Text>
          {contact.pendingDebts.map((debt) => (
            <View key={debt.debtId} style={styles.debtRow}>
              <Text style={styles.debtAmount}>${debt.amountUsd.toFixed(2)}</Text>
              <Text style={styles.debtDue}>
                due {new Date(debt.dueDate).toLocaleDateString()}
              </Text>
            </View>
          ))}
          <Text style={styles.totalOwed}>
            Total outstanding: ${contact.totalOutstandingUsd.toFixed(2)}
          </Text>
        </View>
      )}

      {!requiresConfirmation && (
        <View style={styles.actions}>
          {contact.solanaWalletAddress ? (
            <TouchableOpacity style={styles.payButton} onPress={onStartPayment}>
              <Text style={styles.payButtonText}>Pay {contact.name}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.noWalletBanner}>
              <Text style={styles.noWalletText}>No wallet linked</Text>
            </View>
          )}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#111',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
    maxHeight: '60%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#444',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  confirmBanner: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  confirmText: {
    color: Colors.palette.yellow400,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
  },
  confirmButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  confirmYes: {
    backgroundColor: Colors.palette.cyan500,
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 10,
  },
  confirmNo: {
    borderWidth: 1.5,
    borderColor: '#555',
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 10,
  },
  confirmBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  confirmBtnTextDeny: {
    color: '#aaa',
    fontWeight: '600',
    fontSize: 15,
  },
  header: {
    marginBottom: 14,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.palette.cyan600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  nameBlock: {
    flex: 1,
  },
  name: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  wallet: {
    color: '#888',
    fontSize: 13,
    fontFamily: 'SpaceMono',
    marginTop: 2,
  },
  phone: {
    color: '#777',
    fontSize: 12,
    marginTop: 2,
  },
  lastPayment: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  label: {
    color: '#666',
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    color: '#ccc',
    fontSize: 14,
  },
  debtsSection: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  debtRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  debtAmount: {
    color: Colors.palette.red400,
    fontSize: 15,
    fontWeight: '600',
  },
  debtDue: {
    color: '#777',
    fontSize: 13,
  },
  totalOwed: {
    color: Colors.palette.red400,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
  },
  actions: {
    marginTop: 16,
    gap: 10,
  },
  payButton: {
    backgroundColor: Colors.palette.cyan500,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  payButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  noWalletBanner: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  noWalletText: {
    color: '#666',
    fontSize: 15,
  },
  closeButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#666',
    fontSize: 15,
  },
});
