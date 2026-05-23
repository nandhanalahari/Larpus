import { View, Text, StyleSheet, FlatList, SafeAreaView } from 'react-native';
import { useAppStore, Transaction, Debt } from '@/store/appStore';
import Colors from '@/constants/Colors';

type ListItem =
  | { type: 'section_header'; title: string; key: string }
  | { type: 'debt'; data: Debt; key: string }
  | { type: 'transaction'; data: Transaction; key: string };

export default function HistoryScreen() {
  const { transactions, debts } = useAppStore();

  const pendingDebts = debts.filter((d) => d.status === 'pending');
  const recentTx = transactions.slice(0, 50);

  const listData: ListItem[] = [];
  if (pendingDebts.length > 0) {
    listData.push({ type: 'section_header', title: 'Pending Debts', key: 'h-debts' });
    pendingDebts.forEach((d, i) => listData.push({ type: 'debt', data: d, key: `debt-${i}` }));
  }
  if (recentTx.length > 0) {
    listData.push({ type: 'section_header', title: 'Recent Transactions', key: 'h-tx' });
    recentTx.forEach((t, i) => listData.push({ type: 'transaction', data: t, key: `tx-${i}` }));
  }

  const hasContent = listData.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>History</Text>

      {!hasContent ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>{'\u23F3'}</Text>
          <Text style={styles.emptyTitle}>No transactions yet</Text>
          <Text style={styles.emptyDesc}>
            Your payment history will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => {
            if (item.type === 'section_header') {
              return <Text style={styles.sectionHeader}>{item.title}</Text>;
            }

            if (item.type === 'debt') {
              const debt = item.data;
              return (
                <View style={styles.row}>
                  <View style={[styles.dot, { backgroundColor: Colors.palette.yellow400 }]} />
                  <View style={styles.rowContent}>
                    <Text style={styles.rowName}>{debt.contactName}</Text>
                    <Text style={styles.rowDate}>
                      Due {debt.dueDate ? new Date(debt.dueDate).toLocaleDateString() : 'TBD'}
                    </Text>
                  </View>
                  <Text style={[styles.rowAmount, { color: Colors.palette.yellow400 }]}>
                    ${debt.amountUsd.toFixed(2)}
                  </Text>
                </View>
              );
            }

            const tx = item.data;
            const isConfirmed = tx.status === 'confirmed';
            return (
              <View style={styles.row}>
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor: isConfirmed
                        ? Colors.palette.green400
                        : Colors.palette.red400,
                    },
                  ]}
                />
                <View style={styles.rowContent}>
                  <Text style={styles.rowName}>{tx.contactName}</Text>
                  <Text style={styles.rowDate}>
                    {new Date(tx.createdAt).toLocaleDateString()}{' '}
                    {'\u00B7'} {tx.amountSol.toFixed(4)} SOL
                  </Text>
                </View>
                <Text
                  style={[
                    styles.rowAmount,
                    { color: isConfirmed ? Colors.palette.green400 : Colors.palette.red400 },
                  ]}
                >
                  ${tx.amountUsd.toFixed(2)}
                </Text>
              </View>
            );
          }}
          style={styles.list}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
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
  },
  list: {
    flex: 1,
  },
  sectionHeader: {
    color: '#666',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#111',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 14,
  },
  rowContent: {
    flex: 1,
  },
  rowName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  rowDate: {
    color: '#555',
    fontSize: 12,
    marginTop: 2,
  },
  rowAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
});
