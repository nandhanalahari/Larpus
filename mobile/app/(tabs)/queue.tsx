import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native';
import { useQueue } from '@/hooks/useQueue';
import { useWallet } from '@/hooks/useWallet';
import { QueueItemRow } from '@/components/QueueItem';
import { WalletBalance } from '@/components/WalletBalance';
import Colors from '@/constants/Colors';

export default function QueueScreen() {
  const { queue, remove, clear, executeAll, totalUsd, totalSol, canAffordAll } = useQueue();
  const { walletAddress, walletBalanceSol, solPrice, refreshBalance } = useWallet();

  const waitingCount = queue.filter((i) => i.status === 'waiting').length;
  const hasItems = queue.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Payment Queue</Text>

      <WalletBalance
        balanceSol={walletBalanceSol}
        solPrice={solPrice}
        walletAddress={walletAddress}
        onRefresh={refreshBalance}
      />

      {!hasItems ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>{'\u2630'}</Text>
          <Text style={styles.emptyTitle}>No payments queued</Text>
          <Text style={styles.emptyDesc}>
            Scan faces on the camera tab to add payments here
          </Text>
        </View>
      ) : (
        <>
          <FlatList
            data={queue}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <QueueItemRow item={item} onRemove={() => remove(item.id)} />
            )}
            style={styles.list}
          />

          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total</Text>
              <View style={styles.summaryValues}>
                <Text style={styles.summaryUsd}>${totalUsd.toFixed(2)}</Text>
                <Text style={styles.summarySol}>~{totalSol.toFixed(4)} SOL</Text>
              </View>
            </View>

            {!canAffordAll && waitingCount > 0 && (
              <View style={styles.warningBanner}>
                <Text style={styles.warningText}>
                  Insufficient balance for all payments
                </Text>
              </View>
            )}

            <View style={styles.actions}>
              <TouchableOpacity
                style={[
                  styles.payAllBtn,
                  waitingCount === 0 && styles.btnDisabled,
                ]}
                onPress={executeAll}
                disabled={waitingCount === 0}
              >
                <Text style={styles.payAllText}>
                  Pay All ({waitingCount})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.clearBtn} onPress={clear}>
                <Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    paddingTop: 60,
    paddingHorizontal: 16,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 20,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 100,
  },
  emptyIcon: {
    fontSize: 48,
    color: '#333',
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#555',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyDesc: {
    color: '#444',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  list: {
    flex: 1,
  },
  summary: {
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    color: '#888',
    fontSize: 16,
    fontWeight: '600',
  },
  summaryValues: {
    alignItems: 'flex-end',
  },
  summaryUsd: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  summarySol: {
    color: '#666',
    fontSize: 13,
  },
  warningBanner: {
    backgroundColor: 'rgba(234, 179, 8, 0.12)',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  warningText: {
    color: Colors.palette.yellow400,
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  payAllBtn: {
    flex: 1,
    backgroundColor: Colors.palette.cyan500,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.4,
  },
  payAllText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  clearBtn: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#222',
    alignItems: 'center',
  },
  clearText: {
    color: '#666',
    fontSize: 15,
  },
});
