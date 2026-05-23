import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Colors from '@/constants/Colors';
import type { QueueItem as QueueItemType } from '@/store/appStore';

type Props = {
  item: QueueItemType;
  onRemove: () => void;
};

const statusConfig = {
  waiting: { color: '#666', label: 'Waiting', icon: '\u25A1' },
  sending: { color: Colors.palette.cyan400, label: 'Sending...', icon: '\u23F3' },
  confirmed: { color: Colors.palette.green400, label: 'Confirmed', icon: '\u2713' },
  failed: { color: Colors.palette.red400, label: 'Failed', icon: '\u2717' },
};

export function QueueItemRow({ item, onRemove }: Props) {
  const cfg = statusConfig[item.status];

  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <View style={[styles.avatar, { borderColor: cfg.color }]}>
          <Text style={styles.avatarText}>{item.contact.name.charAt(0)}</Text>
        </View>
        <View>
          <Text style={styles.name}>{item.contact.name}</Text>
          {item.error && <Text style={styles.error}>{item.error}</Text>}
        </View>
      </View>
      <View style={styles.right}>
        <Text style={styles.amount}>${item.amountUsd.toFixed(2)}</Text>
        <Text style={[styles.status, { color: cfg.color }]}>
          {cfg.icon} {cfg.label}
        </Text>
      </View>
      {item.status === 'waiting' && (
        <TouchableOpacity style={styles.removeBtn} onPress={onRemove}>
          <Text style={styles.removeText}>\u2715</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#222',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  name: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  error: {
    color: Colors.palette.red400,
    fontSize: 11,
    marginTop: 2,
  },
  right: {
    alignItems: 'flex-end',
    marginRight: 8,
  },
  amount: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  status: {
    fontSize: 12,
    marginTop: 2,
  },
  removeBtn: {
    padding: 6,
  },
  removeText: {
    color: '#555',
    fontSize: 14,
  },
});
