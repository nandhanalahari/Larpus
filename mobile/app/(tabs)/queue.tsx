/**
 * Queue tab — Kolana Variant A.
 *
 * Robinhood-minimal: huge total at the top, sparse rows below, single cyan
 * "Pay all" CTA, ghost "Clear queue" beneath. Scrollable with bottom padding
 * to clear the floating tab bar (which sits at bottom: 24, height 64).
 */
import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useQueue } from '@/hooks/useQueue';
import { useWallet } from '@/hooks/useWallet';
import { KolanaButton } from '@/components/ui/kolana';
import { theme } from '@/constants/theme';
import type { QueueItem } from '@/store/appStore';

export default function QueueScreen() {
  const { queue, remove, clear, executeAll, totalUsd, canAffordAll } =
    useQueue();
  const { refreshBalance } = useWallet();
  const [paying, setPaying] = useState(false);

  const waitingCount = queue.filter((i) => i.status === 'waiting').length;

  const handlePayAll = async () => {
    if (paying || waitingCount === 0) return;
    setPaying(true);
    try {
      await executeAll();
      await refreshBalance();
    } finally {
      setPaying(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.label}>Batch queue</Text>

        <Text style={styles.totalBig}>
          ${Math.floor(totalUsd).toLocaleString()}
          <Text style={styles.totalBigDim}>
            .{(totalUsd % 1).toFixed(2).slice(2) || '00'}
          </Text>
        </Text>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>
            {queue.length} {queue.length === 1 ? 'payment' : 'payments'} ·{' '}
            {waitingCount} waiting
          </Text>
          {!canAffordAll && waitingCount > 0 ? (
            <Text style={styles.warnInline}>insufficient balance</Text>
          ) : null}
        </View>

        {queue.length === 0 ? (
          <View style={styles.empty}>
            <MaterialIcons
              name="view-list"
              size={36}
              color={theme.colors.textFaint}
            />
            <Text style={styles.emptyTitle}>No payments queued</Text>
            <Text style={styles.emptyDesc}>
              Scan faces on the Scan tab to add payments here.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionHeader}>Items</Text>
            {queue.map((item, i) => (
              <QueueRow
                key={item.id}
                item={item}
                last={i === queue.length - 1}
                onRemove={() => remove(item.id)}
              />
            ))}

            <View style={styles.actions}>
              <KolanaButton
                kind="primary"
                icon="send"
                onPress={handlePayAll}
                disabled={waitingCount === 0 || paying || !canAffordAll}
              >
                {paying
                  ? 'Sending…'
                  : `Pay all · $${totalUsd.toFixed(2)}`}
              </KolanaButton>

              <TouchableOpacity onPress={clear} style={styles.clearBtn}>
                <Text style={styles.clearText}>Clear queue</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── One queue row ──────────────────────────────────────────────────────
function QueueRow({
  item,
  last,
  onRemove,
}: {
  item: QueueItem;
  last: boolean;
  onRemove: () => void;
}) {
  const meta = STATUS_META[item.status];
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <View style={[styles.avatar, { backgroundColor: meta.iconBg }]}>
        <MaterialIcons name={meta.icon} size={16} color={meta.iconColor} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.name} numberOfLines={1}>
          {item.contact.name}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {meta.label}
          {item.note ? ` · ${item.note}` : ''}
          {item.error ? ` · ${item.error}` : ''}
        </Text>
      </View>
      <Text style={styles.amount}>${item.amountUsd.toFixed(2)}</Text>
      {item.status === 'waiting' ? (
        <TouchableOpacity onPress={onRemove} hitSlop={10} style={styles.removeBtn}>
          <MaterialIcons name="close" size={16} color={theme.colors.textDim} />
        </TouchableOpacity>
      ) : (
        <View style={styles.removeBtn} />
      )}
    </View>
  );
}

const STATUS_META: Record<
  QueueItem['status'],
  {
    label: string;
    icon: keyof typeof MaterialIcons.glyphMap;
    iconColor: string;
    iconBg: string;
  }
> = {
  waiting: {
    label: 'Waiting',
    icon: 'schedule',
    iconColor: theme.colors.textDim,
    iconBg: 'rgba(230,240,255,0.06)',
  },
  sending: {
    label: 'Sending…',
    icon: 'bolt',
    iconColor: theme.colors.accent,
    iconBg: theme.colors.accent + '1a',
  },
  confirmed: {
    label: 'Confirmed',
    icon: 'check',
    iconColor: theme.colors.success,
    iconBg: theme.colors.success + '1a',
  },
  failed: {
    label: 'Failed',
    icon: 'close',
    iconColor: theme.colors.alert,
    iconBg: theme.colors.alert + '1a',
  },
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  scroll: {
    paddingHorizontal: theme.spacing.marginMobile,
    paddingTop: 24,
    paddingBottom: 120, // clear floating tab bar
  },
  label: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 14,
    color: theme.colors.textDim,
    marginBottom: 6,
  },
  totalBig: {
    fontFamily: theme.fonts.display,
    fontSize: 50,
    color: theme.colors.text,
    letterSpacing: -2,
    lineHeight: 52,
  },
  totalBigDim: {
    color: theme.colors.textDim,
  },
  metaRow: {
    marginTop: 10,
    marginBottom: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  metaText: {
    fontFamily: theme.fonts.body,
    fontSize: 13,
    color: theme.colors.textDim,
  },
  warnInline: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 12,
    color: theme.colors.alert,
    textTransform: 'lowercase',
  },
  sectionHeader: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 12,
    color: theme.colors.textDim,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 15,
    color: theme.colors.text,
  },
  sub: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
    color: theme.colors.textDim,
    marginTop: 2,
  },
  amount: {
    fontFamily: theme.fonts.display,
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
  },
  removeBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 10,
  },
  emptyTitle: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 15,
    color: theme.colors.text,
  },
  emptyDesc: {
    fontFamily: theme.fonts.body,
    fontSize: 13,
    color: theme.colors.textDim,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  actions: {
    marginTop: 28,
    gap: 12,
  },
  clearBtn: {
    alignSelf: 'center',
    paddingVertical: 10,
  },
  clearText: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 13,
    color: theme.colors.textDim,
  },
});
