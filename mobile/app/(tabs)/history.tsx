import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppStore, Transaction, Debt } from '@/store/appStore';
import { TopAppBar } from '@/components/ui/TopAppBar';
import { theme } from '@/constants/theme';

type ListItem =
  | { type: 'section_header'; title: string; key: string }
  | { type: 'debt'; data: Debt; key: string }
  | { type: 'transaction'; data: Transaction; key: string };

const DEMO_HISTORY = [
  { label: 'Received', date: 'Oct 25, 2023', amount: '+ 2.50 SOL', incoming: true },
  { label: 'Sent', date: 'Oct 20, 2023', amount: '- 1.00 SOL', incoming: false },
  { label: 'Received', date: 'Oct 15, 2023', amount: '+ 10.00 SOL', incoming: true },
];

export default function HistoryScreen() {
  const { transactions, debts } = useAppStore();

  const pendingDebts = debts.filter((d) => d.status === 'pending');
  const recentTx = transactions.slice(0, 50);

  const listData: ListItem[] = [];
  if (pendingDebts.length > 0) {
    listData.push({ type: 'section_header', title: 'Pending Debts', key: 'h-debts' });
    pendingDebts.forEach((d, i) =>
      listData.push({ type: 'debt', data: d, key: `debt-${i}` }),
    );
  }
  if (recentTx.length > 0) {
    listData.push({
      type: 'section_header',
      title: 'Recent Transactions',
      key: 'h-tx',
    });
    recentTx.forEach((t, i) =>
      listData.push({ type: 'transaction', data: t, key: `tx-${i}` }),
    );
  }

  const hasContent = listData.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <TopAppBar />
      <View style={styles.body}>
        {!hasContent ? (
          <>
            <View style={styles.successHero}>
              <View style={styles.iconRing}>
                <MaterialIcons name="check" size={40} color={theme.colors.tertiary} />
              </View>
              <Text style={styles.amountHero}>+ 5.00 SOL</Text>
              <Text style={styles.confirmed}>Confirmed</Text>
            </View>

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
                <Text style={styles.rowValue}>2023-10-27 14:32:01 UTC</Text>
              </View>
              <View style={[styles.tableRow, styles.tableRowLast]}>
                <Text style={styles.rowLabel}>Signature</Text>
                <Text style={styles.rowValue}>4vJ9JU1bJJE96FWS…</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>
              Recent History with Alice
            </Text>
            <View style={styles.historyCard}>
              {DEMO_HISTORY.map((item, i) => (
                <View
                  key={item.date}
                  style={[
                    styles.historyRow,
                    i < DEMO_HISTORY.length - 1 && styles.historyRowBorder,
                  ]}
                >
                  <View style={styles.historyLeft}>
                    <View style={styles.historyIcon}>
                      <MaterialIcons
                        name={item.incoming ? 'arrow-downward' : 'arrow-upward'}
                        size={16}
                        color={
                          item.incoming
                            ? theme.colors.primary
                            : theme.colors.outline
                        }
                      />
                    </View>
                    <View>
                      <Text style={styles.historyLabel}>{item.label}</Text>
                      <Text style={styles.historyDate}>{item.date}</Text>
                    </View>
                  </View>
                  <View style={styles.historyRight}>
                    <Text
                      style={[
                        styles.historyAmount,
                        !item.incoming && styles.historyAmountMuted,
                      ]}
                    >
                      {item.amount}
                    </Text>
                    <MaterialIcons
                      name="chevron-right"
                      size={20}
                      color={theme.colors.outline}
                    />
                  </View>
                </View>
              ))}
            </View>

            <Text style={styles.emptyHint}>
              Live payments from Scan will appear above this demo layout.
            </Text>
          </>
        ) : (
          <FlatList
            data={listData}
            keyExtractor={(item) => item.key}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              if (item.type === 'section_header') {
                return (
                  <Text style={styles.sectionTitle}>{item.title}</Text>
                );
              }
              if (item.type === 'debt') {
                const debt = item.data;
                return (
                  <View style={styles.historyRow}>
                    <Text style={styles.historyLabel}>{debt.contactName}</Text>
                    <Text style={[styles.historyAmount, styles.amountPending]}>
                      ${debt.amountUsd.toFixed(2)} pending
                    </Text>
                  </View>
                );
              }
              const tx = item.data;
              const incoming = tx.status === 'confirmed';
              return (
                <View
                  style={[styles.historyRow, styles.historyRowBorder]}
                >
                  <View style={styles.historyLeft}>
                    <View style={styles.historyIcon}>
                      <MaterialIcons
                        name="arrow-downward"
                        size={16}
                        color={theme.colors.primary}
                      />
                    </View>
                    <View>
                      <Text style={styles.historyLabel}>{tx.contactName}</Text>
                      <Text style={styles.historyDate}>
                        {new Date(tx.createdAt).toLocaleDateString()} ·{' '}
                        {tx.amountSol.toFixed(4)} SOL
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={[
                      styles.historyAmount,
                      !incoming && styles.historyAmountMuted,
                    ]}
                  >
                    ${tx.amountUsd.toFixed(2)}
                  </Text>
                </View>
              );
            }}
          />
        )}

        <TouchableOpacity
          style={styles.returnBtn}
          onPress={() => router.push('/(tabs)' as any)}
        >
          <MaterialIcons name="arrow-back" size={18} color={theme.colors.primary} />
          <Text style={styles.returnText}>Return to Scan</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.black,
  },
  body: {
    flex: 1,
    paddingHorizontal: theme.spacing.marginMobile,
    paddingBottom: 24,
  },
  successHero: {
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
  confirmed: {
    fontFamily: theme.fonts.mono,
    fontSize: 14,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: theme.colors.tertiary,
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
  },
  sectionTitle: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: theme.colors.onSurfaceVariant,
    marginBottom: 12,
  },
  historyCard: {
    borderWidth: 1,
    borderColor: theme.colors.hardBorder,
    backgroundColor: theme.colors.surfaceContainerLowest,
    borderRadius: theme.radius.default,
    overflow: 'hidden',
    marginBottom: 16,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  historyRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.panelBg,
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  historyIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.hardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  historyLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 14,
    color: theme.colors.primary,
  },
  historyDate: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: theme.colors.onSurfaceVariant,
    marginTop: 4,
  },
  historyRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyAmount: {
    fontFamily: theme.fonts.mono,
    fontSize: 14,
    color: theme.colors.primary,
  },
  historyAmountMuted: {
    color: theme.colors.outline,
  },
  amountPending: {
    color: theme.colors.error,
  },
  emptyHint: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    color: theme.colors.onPrimaryContainer,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  listContent: {
    paddingTop: 16,
    paddingBottom: 16,
  },
  returnBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 'auto',
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
