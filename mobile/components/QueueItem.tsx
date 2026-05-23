import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import type { QueueItem as QueueItemType } from '@/store/appStore';

type Props = {
  item: QueueItemType;
  onRemove: () => void;
};

function StatusChip({ status }: { status: QueueItemType['status'] }) {
  if (status === 'waiting') {
    return (
      <View style={styles.chip}>
        <View style={styles.chipDotMuted} />
        <Text style={styles.chipTextMuted}>Waiting</Text>
      </View>
    );
  }
  if (status === 'sending') {
    return (
      <View style={[styles.chip, styles.chipActive]}>
        <View style={styles.chipDotActive} />
        <Text style={styles.chipTextActive}>Processing…</Text>
      </View>
    );
  }
  if (status === 'confirmed') {
    return (
      <View style={[styles.chip, styles.chipDone]}>
        <MaterialIcons name="check" size={12} color={theme.colors.primary} />
        <Text style={styles.chipTextDone}>Confirmed</Text>
      </View>
    );
  }
  return (
    <View style={styles.chip}>
      <Text style={styles.chipTextMuted}>Failed</Text>
    </View>
  );
}

export function QueueItemRow({ item, onRemove }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <View style={styles.avatar}>
          <MaterialIcons
            name="person"
            size={20}
            color={theme.colors.onSurfaceVariant}
          />
        </View>
        <View>
          <Text style={styles.name}>{item.contact.name}</Text>
          <Text style={styles.amountSub}>${item.amountUsd.toFixed(2)}</Text>
          {item.error && <Text style={styles.error}>{item.error}</Text>}
        </View>
      </View>
      <View style={styles.right}>
        <StatusChip status={item.status} />
        {item.status === 'waiting' && (
          <TouchableOpacity style={styles.removeBtn} onPress={onRemove}>
            <MaterialIcons name="close" size={16} color={theme.colors.outline} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outlineVariant,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
    backgroundColor: theme.colors.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontFamily: theme.fonts.mono,
    fontSize: 14,
    color: theme.colors.primary,
  },
  amountSub: {
    fontFamily: theme.fonts.mono,
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    marginTop: 2,
  },
  error: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    color: theme.colors.error,
    marginTop: 2,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
  },
  chipActive: {
    borderColor: `${theme.colors.tertiary}80`,
    backgroundColor: `${theme.colors.tertiary}0D`,
  },
  chipDone: {
    borderColor: theme.colors.primary,
  },
  chipDotMuted: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.outline,
  },
  chipDotActive: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.tertiary,
  },
  chipTextMuted: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: theme.colors.onSurfaceVariant,
  },
  chipTextActive: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: theme.colors.tertiary,
  },
  chipTextDone: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: theme.colors.primary,
  },
  removeBtn: {
    padding: 4,
  },
});
