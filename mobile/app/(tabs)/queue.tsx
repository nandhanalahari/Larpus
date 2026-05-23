import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useQueue } from '@/hooks/useQueue';
import { useWallet } from '@/hooks/useWallet';
import { QueueItemRow } from '@/components/QueueItem';
import { TopAppBar } from '@/components/ui/TopAppBar';
import { theme } from '@/constants/theme';

export default function QueueScreen() {
  const { queue, remove, clear, executeAll, totalUsd, canAffordAll } = useQueue();
  const { refreshBalance } = useWallet();

  const waitingCount = queue.filter((i) => i.status === 'waiting').length;
  const hasItems = queue.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <TopAppBar onWalletPress={() => refreshBalance()} />
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Batch Queue</Text>
          <Text style={styles.subtitle}>Execute pending transactions</Text>
        </View>

        {!hasItems ? (
          <View style={styles.empty}>
            <MaterialIcons
              name="view-list"
              size={48}
              color={theme.colors.surfaceContainerHigh}
            />
            <Text style={styles.emptyTitle}>No payments queued</Text>
            <Text style={styles.emptyDesc}>
              Scan faces on the Scan tab to add payments here
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.summary}>
              <View style={styles.summaryTop}>
                <Text style={styles.summaryLabel}>Total Pending</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{queue.length} TXNS</Text>
                </View>
              </View>
              <Text style={styles.summaryAmount}>
                ${totalUsd.toFixed(2)}{' '}
                <Text style={styles.summaryUnit}>USDC</Text>
              </Text>
            </View>

            <View style={styles.listCard}>
              <FlatList
                data={queue}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <QueueItemRow item={item} onRemove={() => remove(item.id)} />
                )}
                style={styles.list}
                scrollEnabled={false}
              />
            </View>

            {!canAffordAll && waitingCount > 0 && (
              <Text style={styles.warning}>
                Insufficient balance for all payments
              </Text>
            )}

            <TouchableOpacity
              style={[
                styles.payAllBtn,
                waitingCount === 0 && styles.btnDisabled,
              ]}
              onPress={executeAll}
              disabled={waitingCount === 0}
            >
              <Text style={styles.payAllText}>Pay All Now</Text>
              <MaterialIcons
                name="send"
                size={18}
                color={theme.colors.onTertiary}
              />
            </TouchableOpacity>

            <TouchableOpacity style={styles.clearBtn} onPress={clear}>
              <Text style={styles.clearText}>Clear queue</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.marginMobile,
    paddingBottom: 24,
  },
  header: {
    paddingTop: 24,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: theme.colors.onBackground,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: theme.fonts.mono,
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80,
    gap: 12,
  },
  emptyTitle: {
    fontFamily: theme.fonts.mono,
    fontSize: 16,
    color: theme.colors.onSurfaceVariant,
  },
  emptyDesc: {
    fontFamily: theme.fonts.mono,
    fontSize: 13,
    color: theme.colors.onPrimaryContainer,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  summary: {
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
    backgroundColor: theme.colors.surfaceContainerLowest,
    padding: 24,
    marginBottom: 24,
    gap: 12,
  },
  summaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: theme.colors.onSurfaceVariant,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
    backgroundColor: theme.colors.surfaceVariant,
  },
  badgeText: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    color: theme.colors.primary,
  },
  summaryAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.colors.primary,
    letterSpacing: -0.5,
  },
  summaryUnit: {
    fontFamily: theme.fonts.mono,
    fontSize: 16,
    color: theme.colors.onSurfaceVariant,
  },
  listCard: {
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
    backgroundColor: theme.colors.surface,
    marginBottom: 16,
  },
  list: {
    maxHeight: 320,
  },
  warning: {
    fontFamily: theme.fonts.mono,
    fontSize: 13,
    color: theme.colors.error,
    textAlign: 'center',
    marginBottom: 12,
  },
  payAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.tertiary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 999,
    alignSelf: 'flex-end',
    marginBottom: 12,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  payAllText: {
    fontFamily: theme.fonts.mono,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: theme.colors.onTertiary,
  },
  clearBtn: {
    alignSelf: 'center',
    paddingVertical: 8,
  },
  clearText: {
    fontFamily: theme.fonts.mono,
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
  },
});
