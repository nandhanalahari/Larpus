import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useAppStore } from '@/store/appStore';
import { useWallet } from '@/hooks/useWallet';
import { WalletBalance } from '@/components/WalletBalance';
import { TopAppBar } from '@/components/ui/TopAppBar';
import { solanaService } from '@/services/solana';
import { api, UserDebtsResponse } from '@/services/api';
import { theme } from '@/constants/theme';
import { useState, useCallback, useRef } from 'react';

export default function ProfileScreen() {
  const {
    userName,
    walletAddress,
    walletBalanceSol,
    solPrice,
    demoMode,
    toggleDemoMode,
    serverReady,
    signOut,
  } = useAppStore();

  const { refreshBalance } = useWallet();
  const [longPressCount, setLongPressCount] = useState(0);
  const [importKey, setImportKey] = useState('');
  const [importing, setImporting] = useState(false);
  const [showImport, setShowImport] = useState(false);

  // Stats pulled from MongoDB — not local device storage
  const [txCount, setTxCount] = useState<number>(0);
  const [totalPaid, setTotalPaid] = useState<number>(0);
  const [ledger, setLedger] = useState<UserDebtsResponse | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  const pendingDebtCount =
    (ledger?.owed_by_me.filter((d) => d.status === 'pending' || d.status === 'scheduled').length ?? 0) +
    (ledger?.owed_to_me.filter((d) => d.status === 'pending' || d.status === 'scheduled').length ?? 0);

  const refreshLedger = useCallback(async () => {
    if (!walletAddress) return;
    try {
      const [debtsRes, historyRes] = await Promise.allSettled([
        api.getUserDebts(walletAddress),
        api.getTransactionHistory(walletAddress, 100, false),
      ]);
      if (debtsRes.status === 'fulfilled') setLedger(debtsRes.value);
      if (historyRes.status === 'fulfilled') {
        const txs = historyRes.value.transactions;
        setTxCount(txs.length);
        // Sum up USD value of all sent transactions
        const paid = txs
          .filter((t) => t.direction === 'sent')
          .reduce((sum, t) => sum + (t.amount_sol * (solPrice ?? 0)), 0);
        setTotalPaid(paid);
      }
    } catch (err) {
      console.warn('[ledger] fetch failed:', err);
    }
  }, [walletAddress, solPrice]);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useFocusEffect(
    useCallback(() => {
      refreshBalance();
      setLedgerLoading(true);
      refreshLedger().finally(() => setLedgerLoading(false));
      // Poll wallet + ledger every 10s so changes appear in near-real-time.
      pollRef.current = setInterval(() => {
        refreshBalance();
        refreshLedger();
      }, 10000);
      return () => {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      };
    }, [refreshBalance, refreshLedger]),
  );

  const handleAirdrop = useCallback(async () => {
    if (!walletAddress) return;
    try {
      await solanaService.requestAirdrop(walletAddress, 2);
      await refreshBalance();
      Alert.alert('Airdrop', '2 SOL added to your wallet (devnet)');
    } catch {
      Alert.alert(
        'Airdrop Failed',
        'Devnet faucet may be rate-limited. Try again later.',
      );
    }
  }, [walletAddress, refreshBalance]);

  const handleVersionLongPress = useCallback(() => {
    const next = longPressCount + 1;
    setLongPressCount(next);
    if (next >= 3) {
      toggleDemoMode();
      setLongPressCount(0);
    }
  }, [longPressCount, toggleDemoMode]);

  const handleCreateWallet = useCallback(async () => {
    try {
      const { publicKey } = await solanaService.createWallet();
      useAppStore.getState().setUser(userName ?? 'User', publicKey);
      await refreshBalance();
      Alert.alert('Wallet Created', `Address: ${solanaService.shortenAddress(publicKey)}`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create wallet');
    }
  }, [userName, refreshBalance]);

  const handleImportWallet = useCallback(async () => {
    if (!importKey.trim()) return;
    setImporting(true);
    try {
      const parsed = JSON.parse(importKey.trim());
      if (!Array.isArray(parsed)) throw new Error('Expected a JSON array of numbers');
      const publicKey = await solanaService.importWallet(parsed);
      useAppStore.getState().setUser(userName ?? '', publicKey);
      await refreshBalance();
      setImportKey('');
      setShowImport(false);
      Alert.alert('Wallet Imported', `Address: ${solanaService.shortenAddress(publicKey)}`);
    } catch (err: any) {
      Alert.alert('Import Failed', err.message || 'Invalid secret key format');
    } finally {
      setImporting(false);
    }
  }, [importKey, userName, refreshBalance]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <TopAppBar showWallet={false} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Wallet</Text>

        <View style={styles.nameSection}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarText}>
              {userName?.charAt(0).toUpperCase() || '?'}
            </Text>
          </View>
          <Text style={styles.name}>{userName || 'Not set up'}</Text>
        </View>

        <WalletBalance
          balanceSol={walletBalanceSol}
          solPrice={solPrice}
          walletAddress={walletAddress}
          onRefresh={refreshBalance}
        />

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{txCount}</Text>
            <Text style={styles.statLabel}>Transactions</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>${totalPaid.toFixed(0)}</Text>
            <Text style={styles.statLabel}>Total Paid</Text>
          </View>
          <View style={styles.stat}>
            <Text
              style={[
                styles.statValue,
                pendingDebtCount > 0 && { color: theme.colors.error },
              ]}
            >
              {pendingDebtCount}
            </Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
        </View>

        <Text style={styles.sectionHeader}>Ledger</Text>

        <View style={styles.ledgerRow}>
          <View style={[styles.ledgerCard, styles.ledgerOwe]}>
            <Text style={styles.ledgerLabel}>I owe</Text>
            <Text style={styles.ledgerAmount}>
              ${ledger?.total_i_owe_usd.toFixed(2) ?? '0.00'}
            </Text>
            <Text style={styles.ledgerCount}>
              {ledger?.owed_by_me.filter((d) => d.status !== 'paid').length ?? 0} pending
            </Text>
          </View>
          <View style={[styles.ledgerCard, styles.ledgerOwed]}>
            <Text style={styles.ledgerLabel}>Owed to me</Text>
            <Text style={[styles.ledgerAmount, styles.ledgerAmountPositive]}>
              ${ledger?.total_owed_to_me_usd.toFixed(2) ?? '0.00'}
            </Text>
            <Text style={styles.ledgerCount}>
              {ledger?.owed_to_me.filter((d) => d.status !== 'paid').length ?? 0} pending
            </Text>
          </View>
        </View>

        <Text style={styles.subsectionHeader}>Money I owe</Text>
        {ledger && ledger.owed_by_me.length > 0 ? (
          ledger.owed_by_me.map((d) => (
            <View key={d.debt_id} style={styles.debtRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.debtName}>{d.counterparty_name || 'Unknown'}</Text>
                <Text style={styles.debtMeta}>
                  {d.status.toUpperCase()}
                  {d.due_date ? ` · due ${d.due_date}` : ''}
                </Text>
              </View>
              <Text style={[styles.debtAmount, d.status === 'paid' && styles.debtAmountPaid]}>
                {d.status === 'paid' ? '✓ ' : '-'}${d.amount_usd.toFixed(2)}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyRow}>
            {ledgerLoading ? 'Loading…' : 'No outstanding debts'}
          </Text>
        )}

        <Text style={styles.subsectionHeader}>Owed to me</Text>
        {ledger && ledger.owed_to_me.length > 0 ? (
          ledger.owed_to_me.map((d) => (
            <View key={d.debt_id} style={styles.debtRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.debtName}>{d.counterparty_name || 'Unknown'}</Text>
                <Text style={styles.debtMeta}>
                  {d.status.toUpperCase()}
                  {d.due_date ? ` · due ${d.due_date}` : ''}
                </Text>
              </View>
              <Text
                style={[
                  styles.debtAmount,
                  styles.debtAmountPositive,
                  d.status === 'paid' && styles.debtAmountPaid,
                ]}
              >
                {d.status === 'paid' ? '✓ ' : '+'}${d.amount_usd.toFixed(2)}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyRow}>
            {ledgerLoading ? 'Loading…' : 'Nothing owed to you'}
          </Text>
        )}

        <View style={{ height: 16 }} />

        <TouchableOpacity style={styles.actionBtn} onPress={handleAirdrop}>
          <Text style={styles.actionTitle}>Request Airdrop</Text>
          <Text style={styles.actionDesc}>Get 2 SOL from devnet faucet</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={handleCreateWallet}>
          <Text style={styles.actionTitle}>Create New Wallet</Text>
          <Text style={styles.actionDesc}>Generate a fresh devnet keypair</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => setShowImport(!showImport)}
        >
          <Text style={styles.actionTitle}>Import Wallet</Text>
          <Text style={styles.actionDesc}>Paste a secret key to restore</Text>
        </TouchableOpacity>

        {showImport && (
          <View style={styles.importSection}>
            <TextInput
              style={styles.importInput}
              value={importKey}
              onChangeText={setImportKey}
              placeholder='Paste secret key array [1,2,3,...]'
              placeholderTextColor={theme.colors.onPrimaryContainer}
              multiline
              numberOfLines={3}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.importBtn, importing && styles.btnDisabled]}
              onPress={handleImportWallet}
              disabled={importing}
            >
              {importing ? (
                <ActivityIndicator size="small" color={theme.colors.onTertiary} />
              ) : (
                <Text style={styles.importBtnText}>Import</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.serverStatus}>
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: serverReady
                  ? theme.colors.tertiary
                  : theme.colors.error,
              },
            ]}
          />
          <Text style={styles.serverText}>
            System {serverReady ? 'Operational' : 'Offline'}
          </Text>
          {solPrice != null && (
            <Text style={styles.latency}>Latency 12ms · SOL ${solPrice.toFixed(2)}</Text>
          )}
        </View>

        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={() => {
            Alert.alert(
              'Sign Out',
              'This will clear your session and return you to the login screen. Your wallet keypair stays on the device.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Sign Out',
                  style: 'destructive',
                  onPress: () => {
                    signOut();
                    router.replace('/onboarding/login');
                  },
                },
              ],
            );
          }}
        >
          <Text style={styles.signOutBtnText}>Sign Out</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
        >
          <Text style={styles.backBtnText}>Back to app</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.version}
          onLongPress={handleVersionLongPress}
          delayLongPress={500}
        >
          <Text style={styles.versionText}>
            © 2024 CIPHER {demoMode ? '· DEMO MODE' : ''}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    paddingHorizontal: theme.spacing.marginMobile,
    paddingBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '600',
    color: theme.colors.primary,
    marginTop: 24,
    marginBottom: 24,
  },
  nameSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
    backgroundColor: theme.colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    color: theme.colors.primary,
    fontSize: 30,
    fontWeight: '700',
  },
  name: {
    color: theme.colors.onSurface,
    fontSize: 22,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
    backgroundColor: theme.colors.surfaceContainerLowest,
    padding: 20,
    marginBottom: 20,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontFamily: theme.fonts.mono,
    color: theme.colors.primary,
    fontSize: 22,
    fontWeight: '700',
  },
  statLabel: {
    fontFamily: theme.fonts.mono,
    color: theme.colors.onSurfaceVariant,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 4,
    letterSpacing: 1,
  },
  actionBtn: {
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
    backgroundColor: theme.colors.surfaceContainerLow,
    padding: 16,
    marginBottom: 12,
  },
  actionTitle: {
    fontFamily: theme.fonts.mono,
    color: theme.colors.onSurface,
    fontSize: 14,
    fontWeight: '600',
  },
  actionDesc: {
    fontFamily: theme.fonts.mono,
    color: theme.colors.onSurfaceVariant,
    fontSize: 12,
    marginTop: 4,
  },
  serverStatus: {
    alignItems: 'center',
    marginTop: 20,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  serverText: {
    fontFamily: theme.fonts.mono,
    fontSize: 12,
    color: theme.colors.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  latency: {
    fontFamily: theme.fonts.mono,
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
  },
  signOutBtn: {
    marginTop: 24,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: theme.colors.error,
    alignItems: 'center',
  },
  signOutBtnText: {
    fontFamily: theme.fonts.mono,
    fontSize: 14,
    color: theme.colors.error,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  backBtn: {
    marginTop: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: theme.colors.hardBorder,
    alignItems: 'center',
  },
  backBtnText: {
    fontFamily: theme.fonts.mono,
    fontSize: 14,
    color: theme.colors.primary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  version: {
    marginTop: 24,
    alignSelf: 'center',
    padding: 12,
  },
  versionText: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    color: theme.colors.onPrimaryContainer,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  importSection: {
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
    backgroundColor: theme.colors.surfaceContainerLowest,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  importInput: {
    fontFamily: theme.fonts.mono,
    fontSize: 12,
    color: theme.colors.onSurface,
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
    backgroundColor: theme.colors.surface,
    padding: 12,
    borderRadius: theme.radius.default,
    minHeight: 64,
    textAlignVertical: 'top',
  },
  importBtn: {
    backgroundColor: theme.colors.tertiary,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: theme.radius.default,
  },
  importBtnText: {
    fontFamily: theme.fonts.mono,
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.onTertiary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  sectionHeader: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: theme.colors.onSurfaceVariant,
    marginTop: 8,
    marginBottom: 12,
  },
  subsectionHeader: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: theme.colors.onPrimaryContainer,
    marginTop: 16,
    marginBottom: 6,
  },
  ledgerRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  ledgerCard: {
    flex: 1,
    borderWidth: 1,
    backgroundColor: theme.colors.surfaceContainerLowest,
    padding: 16,
    gap: 4,
  },
  ledgerOwe: {
    borderColor: theme.colors.error,
  },
  ledgerOwed: {
    borderColor: theme.colors.tertiary,
  },
  ledgerLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: theme.colors.onSurfaceVariant,
  },
  ledgerAmount: {
    fontFamily: theme.fonts.mono,
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.error,
  },
  ledgerAmountPositive: {
    color: theme.colors.tertiary,
  },
  ledgerCount: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    color: theme.colors.onPrimaryContainer,
  },
  debtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.panelBg,
  },
  debtName: {
    fontFamily: theme.fonts.mono,
    fontSize: 14,
    color: theme.colors.primary,
  },
  debtMeta: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    color: theme.colors.onPrimaryContainer,
    marginTop: 2,
    letterSpacing: 1,
  },
  debtAmount: {
    fontFamily: theme.fonts.mono,
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.error,
  },
  debtAmountPositive: {
    color: theme.colors.tertiary,
  },
  debtAmountPaid: {
    color: theme.colors.onPrimaryContainer,
    textDecorationLine: 'line-through',
  },
  emptyRow: {
    fontFamily: theme.fonts.mono,
    fontSize: 12,
    color: theme.colors.onPrimaryContainer,
    paddingVertical: 10,
  },
});
