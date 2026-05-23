import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Linking,
  ListRenderItem,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppStore, Debt } from '@/store/appStore';
import { TopAppBar } from '@/components/ui/TopAppBar';
import { api, HistoryTransaction } from '@/services/api';
import { solanaService } from '@/services/solana';
import { theme } from '@/constants/theme';

type ListItem =
  | { type: 'section'; title: string; key: string }
  | { type: 'debt'; data: Debt; key: string }
  | { type: 'tx'; data: HistoryTransaction; key: string };

function relativeTime(blockTime: number): string {
  if (!blockTime) return '—';
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - blockTime);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(blockTime * 1000).toLocaleDateString();
}

export default function HistoryScreen() {
  const { walletAddress } = useAppStore();
  const [transactions, setTransactions] = useState<HistoryTransaction[]>([]);
  const [pendingDebts, setPendingDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (!walletAddress) {
        setError('No wallet — complete onboarding first');
        return;
      }
      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        const [historyRes, debtsRes] = await Promise.allSettled([
          api.getTransactionHistory(walletAddress, 30, true),
          api.getUserDebts(walletAddress),
        ]);
        if (historyRes.status === 'fulfilled') {
          setTransactions(historyRes.value.transactions);
        } else {
          throw new Error(historyRes.reason?.message ?? 'Failed to load history');
        }
        if (debtsRes.status === 'fulfilled') {
          const pending = debtsRes.value.owed_by_me
            .filter((d) => d.status === 'pending' || d.status === 'scheduled')
            .map((d) => ({
              id: d.debt_id,
              contactId: d.to_contact_id,
              contactName: d.counterparty_name,
              amountUsd: d.amount_usd,
              status: d.status as Debt['status'],
              createdAt: d.created_at,
              dueDate: d.due_date ?? undefined,
            }));
          setPendingDebts(pending);
        }
      } catch (err: any) {
        setError(err?.message ?? 'Failed to load history');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [walletAddress],
  );

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchHistory('initial');
      // Poll every 8s while focused so received transactions surface in near-real-time.
      pollRef.current = setInterval(() => {
        fetchHistory('refresh');
      }, 8000);
      return () => {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      };
    }, [fetchHistory]),
  );

  const listData: ListItem[] = [];
  if (pendingDebts.length > 0) {
    listData.push({ type: 'section', title: 'Pending Debts', key: 'h-debts' });
    pendingDebts.forEach((d) =>
      listData.push({ type: 'debt', data: d, key: `debt-${d.id}` }),
    );
  }
  if (transactions.length > 0) {
    listData.push({ type: 'section', title: 'On-chain Activity', key: 'h-tx' });
    transactions.forEach((t) =>
      listData.push({ type: 'tx', data: t, key: `tx-${t.signature}` }),
    );
  }

  const renderItem: ListRenderItem<ListItem> = ({ item }) => {
    if (item.type === 'section') {
      return <Text style={styles.sectionTitle}>{item.title}</Text>;
    }
    if (item.type === 'debt') {
      const debt = item.data;
      return (
        <View style={[styles.row, styles.rowBorder]}>
          <View style={styles.rowLeft}>
            <View style={styles.iconWrap}>
              <MaterialIcons name="schedule" size={16} color={theme.colors.error} />
            </View>
            <View>
              <Text style={styles.rowLabel}>{debt.contactName}</Text>
              <Text style={styles.rowSub}>Pending IOU</Text>
            </View>
          </View>
          <Text style={[styles.amount, styles.amountPending]}>
            ${debt.amountUsd.toFixed(2)}
          </Text>
        </View>
      );
    }

    const tx = item.data;
    const sent = tx.direction === 'sent';
    const counterparty =
      tx.counterparty_name ??
      (tx.counterparty_wallet
        ? solanaService.shortenAddress(tx.counterparty_wallet)
        : 'Unknown');
    return (
      <TouchableOpacity
        style={[styles.row, styles.rowBorder]}
        onPress={() => Linking.openURL(tx.explorer_url)}
        activeOpacity={0.7}
      >
        <View style={styles.rowLeft}>
          <View
            style={[
              styles.iconWrap,
              sent ? styles.iconSent : styles.iconReceived,
            ]}
          >
            <MaterialIcons
              name={sent ? 'arrow-upward' : 'arrow-downward'}
              size={16}
              color={sent ? theme.colors.outline : theme.colors.tertiary}
            />
          </View>
          <View style={styles.rowTextWrap}>
            <Text style={styles.rowLabel}>{counterparty}</Text>
            {tx.notes ? (
              <Text style={styles.noteText} numberOfLines={1}>
                “{tx.notes}”
              </Text>
            ) : null}
            <View style={styles.metaRow}>
              <Text style={styles.rowSub}>
                {sent ? 'Sent to' : 'Received from'} · {relativeTime(tx.block_time)}
              </Text>
              <View style={styles.slotPill}>
                <Text style={styles.slotPillText}>slot {tx.slot}</Text>
              </View>
            </View>
          </View>
        </View>
        <View style={styles.rowRight}>
          <Text
            style={[styles.amount, sent ? styles.amountSent : styles.amountReceived]}
          >
            {sent ? '−' : '+'}
            {tx.amount_sol.toFixed(4)} SOL
          </Text>
          <MaterialIcons
            name="open-in-new"
            size={14}
            color={theme.colors.outline}
          />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <TopAppBar />
      <View style={styles.body}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.colors.tertiary} />
            <Text style={styles.loadingText}>Loading on-chain history…</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <MaterialIcons
              name="error-outline"
              size={32}
              color={theme.colors.error}
            />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => fetchHistory('initial')}
            >
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : listData.length === 0 ? (
          <View style={styles.center}>
            <MaterialIcons
              name="receipt-long"
              size={32}
              color={theme.colors.onSurfaceVariant}
            />
            <Text style={styles.emptyText}>No transactions yet</Text>
            <Text style={styles.emptySub}>
              Send or receive SOL and pull down to refresh.
            </Text>
          </View>
        ) : (
          <FlatList
            data={listData}
            keyExtractor={(item) => item.key}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => fetchHistory('refresh')}
                tintColor={theme.colors.tertiary}
              />
            }
            ListFooterComponent={
              <Text style={styles.footerNote}>
                Verified by Solana Proof of History · tap any row to view on Explorer
              </Text>
            }
          />
        )}

        <TouchableOpacity
          style={styles.returnBtn}
          onPress={() => router.push('/(tabs)' as any)}
        >
          <MaterialIcons
            name="arrow-back"
            size={18}
            color={theme.colors.primary}
          />
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
  loadingText: {
    fontFamily: theme.fonts.mono,
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    letterSpacing: 1,
  },
  errorText: {
    fontFamily: theme.fonts.mono,
    fontSize: 13,
    color: theme.colors.error,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.colors.hardBorder,
    borderRadius: theme.radius.default,
  },
  retryText: {
    fontFamily: theme.fonts.mono,
    fontSize: 13,
    color: theme.colors.primary,
    letterSpacing: 1,
  },
  emptyText: {
    fontFamily: theme.fonts.mono,
    fontSize: 14,
    color: theme.colors.primary,
    letterSpacing: 1,
  },
  emptySub: {
    fontFamily: theme.fonts.mono,
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    textAlign: 'center',
  },
  sectionTitle: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: theme.colors.onSurfaceVariant,
    marginTop: 16,
    marginBottom: 8,
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.panelBg,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  rowTextWrap: {
    flex: 1,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.hardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  iconSent: {
    borderColor: theme.colors.outline,
  },
  iconReceived: {
    borderColor: theme.colors.tertiary,
  },
  rowLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 14,
    color: theme.colors.primary,
  },
  rowSub: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.onSurfaceVariant,
    marginTop: 4,
  },
  noteText: {
    fontSize: 13,
    fontStyle: 'italic',
    color: theme.colors.onSurfaceVariant,
    marginTop: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  slotPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
    borderRadius: 999,
  },
  slotPillText: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    color: theme.colors.tertiary,
    letterSpacing: 0.5,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  amount: {
    fontFamily: theme.fonts.mono,
    fontSize: 14,
    color: theme.colors.primary,
  },
  amountSent: {
    color: theme.colors.outline,
  },
  amountReceived: {
    color: theme.colors.tertiary,
  },
  amountPending: {
    color: theme.colors.error,
  },
  footerNote: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    color: theme.colors.onPrimaryContainer,
    textAlign: 'center',
    marginTop: 20,
    letterSpacing: 0.5,
  },
  returnBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
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
