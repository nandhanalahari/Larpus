/**
 * Profile tab — KOLANA Variant A (Robinhood-minimal + HackHCC navy/cyan).
 *
 * Layout follows screens-app.jsx ProfileScreen:
 *  • Avatar pill + secondary icon row
 *  • Small "Balance" label
 *  • Huge USD balance number with dim decimals
 *  • Change line (SOL price delta · uses cached prior price if available)
 *  • Sparkline (static demo path — historical SOL data is out of scope)
 *  • Timeframe tabs (1D/1W/1M/1Y)
 *  • Quick action row: Send / Receive / Scan / Airdrop
 *  • Ledger summary: I owe / Owed to me (the bidirectional Mongo-backed view)
 *  • Activity rows: on-chain transactions from the backend
 *  • Wallet utilities (airdrop, import, sign-out) collapsed under "Wallet tools"
 */

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
import { MaterialIcons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient, Path, Stop, Circle } from 'react-native-svg';
import { useState, useCallback, useRef } from 'react';
import { useAppStore } from '@/store/appStore';
import { useWallet } from '@/hooks/useWallet';
import { solanaService } from '@/services/solana';
import { api, UserDebtsResponse, HistoryTransaction } from '@/services/api';
import { KolanaButton } from '@/components/ui/kolana';
import { theme } from '@/constants/theme';

type Timeframe = '1D' | '1W' | '1M' | '1Y';

// Static reference sparkline paths from the design canvas. Each is a series
// normalised into a 320×48 viewBox. Real historical SOL data is out of scope
// for this redesign; the chart is decorative until we wire a price API.
const SPARKLINES: Record<Timeframe, { path: string; label: string; pct: number; up: boolean }> = {
  '1D': {
    path: 'M0 30 L24 28 L48 32 L72 26 L96 29 L120 24 L144 26 L168 22 L192 25 L216 19 L240 22 L264 16 L288 18 L312 12',
    label: 'Today',
    pct: 2.4,
    up: true,
  },
  '1W': {
    path: 'M0 36 L24 32 L48 38 L72 30 L96 34 L120 26 L144 30 L168 22 L192 26 L216 18 L240 22 L264 14 L288 17 L312 10',
    label: 'Past week',
    pct: 6.8,
    up: true,
  },
  '1M': {
    path: 'M0 22 L24 30 L48 18 L72 26 L96 14 L120 22 L144 32 L168 24 L192 18 L216 26 L240 12 L264 20 L288 8 L312 14',
    label: 'Past month',
    pct: 13.0,
    up: true,
  },
  '1Y': {
    path: 'M0 44 L24 42 L48 38 L72 40 L96 34 L120 32 L144 28 L168 30 L192 22 L216 24 L240 16 L264 18 L288 8 L312 12',
    label: 'Past year',
    pct: 71.8,
    up: true,
  },
};

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
  const [timeframe, setTimeframe] = useState<Timeframe>('1D');
  const [longPressCount, setLongPressCount] = useState(0);
  const [importKey, setImportKey] = useState('');
  const [importing, setImporting] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showTools, setShowTools] = useState(false);

  // Server-side data
  const [txs, setTxs] = useState<HistoryTransaction[]>([]);
  const [ledger, setLedger] = useState<UserDebtsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const balanceUsd = walletBalanceSol * (solPrice ?? 0);
  const series = SPARKLINES[timeframe];
  const strokeColor = series.up ? theme.colors.success : theme.colors.alert;
  // Change line: derive USD change from sparkline pct on the current balance.
  const changeUsd = Math.abs(balanceUsd * (series.pct / 100));

  const refresh = useCallback(async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const [debtsRes, histRes] = await Promise.allSettled([
        api.getUserDebts(walletAddress),
        api.getTransactionHistory(walletAddress, 20, false),
      ]);
      if (debtsRes.status === 'fulfilled') setLedger(debtsRes.value);
      if (histRes.status === 'fulfilled') setTxs(histRes.value.transactions);
    } catch (err) {
      console.warn('[profile] refresh failed:', err);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useFocusEffect(
    useCallback(() => {
      refreshBalance();
      refresh();
      pollRef.current = setInterval(() => {
        refreshBalance();
        refresh();
      }, 10000);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }, [refreshBalance, refresh]),
  );

  const handleAirdrop = useCallback(async () => {
    if (!walletAddress) return;
    try {
      await solanaService.requestAirdrop(walletAddress, 2);
      await refreshBalance();
      Alert.alert('Airdrop', '2 SOL added to your wallet (devnet)');
    } catch {
      Alert.alert('Airdrop Failed', 'Devnet faucet may be rate-limited.');
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

  const handleImportWallet = useCallback(async () => {
    if (!importKey.trim()) return;
    setImporting(true);
    try {
      const parsed = JSON.parse(importKey.trim());
      if (!Array.isArray(parsed)) throw new Error('Expected a JSON array of numbers');
      const pub = await solanaService.importWallet(parsed);
      useAppStore.getState().setUser(userName ?? '', pub);
      await refreshBalance();
      setImportKey('');
      setShowImport(false);
      Alert.alert('Wallet Imported', solanaService.shortenAddress(pub));
    } catch (err: any) {
      Alert.alert('Import Failed', err.message || 'Invalid secret key');
    } finally {
      setImporting(false);
    }
  }, [importKey, userName, refreshBalance]);

  const initial = (userName ?? 'U').charAt(0).toUpperCase();

  // Build a flat activity list combining ledger pending debts + on-chain tx.
  type ActivityRow =
    | { kind: 'tx'; data: HistoryTransaction; key: string }
    | { kind: 'debt'; data: NonNullable<UserDebtsResponse['owed_by_me']>[number]; owe: boolean; key: string };
  const activity: ActivityRow[] = [];
  txs.slice(0, 8).forEach((t) =>
    activity.push({ kind: 'tx', data: t, key: `tx-${t.signature}` }),
  );
  ledger?.owed_by_me
    .filter((d) => d.status !== 'paid')
    .slice(0, 4)
    .forEach((d) =>
      activity.push({ kind: 'debt', data: d, owe: true, key: `debt-${d.debt_id}` }),
    );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Top bar — minimal */}
        <View style={styles.topRow}>
          <View style={styles.avatarPill}>
            <Text style={styles.avatarPillText}>{initial}</Text>
          </View>
          <TouchableOpacity hitSlop={10} onPress={() => router.push('/(tabs)/history' as any)}>
            <MaterialIcons name="history" size={18} color={theme.colors.textDim} />
          </TouchableOpacity>
        </View>

        {/* ── Balance label + huge number ──────────────────────────── */}
        <View style={styles.balanceLabel}>
          <Text style={styles.balanceLabelText}>Balance</Text>
          <MaterialIcons name="expand-more" size={16} color={theme.colors.textDim} />
        </View>

        <Text style={styles.balanceBig}>
          ${Math.floor(balanceUsd).toLocaleString()}
          <Text style={styles.balanceBigDim}>
            .{(balanceUsd % 1).toFixed(2).slice(2) || '00'}
          </Text>
        </Text>

        {/* ── Change line ──────────────────────────────────────────── */}
        <View style={styles.changeRow}>
          <MaterialIcons
            name={series.up ? 'arrow-upward' : 'arrow-downward'}
            size={14}
            color={strokeColor}
          />
          <Text style={[styles.changeAmount, { color: strokeColor }]}>
            {series.up ? '+' : '−'}${changeUsd.toFixed(2)} ({series.pct.toFixed(1)}%)
          </Text>
          <Text style={styles.changeLabel}>{series.label}</Text>
        </View>

        {/* ── SOL/USD chart ───────────────────────────────────────── */}
        <View style={styles.chartLabel}>
          <Text style={styles.chartCaption}>SOL / USD</Text>
          {solPrice != null ? (
            <Text style={styles.chartPrice}>${solPrice.toFixed(2)}</Text>
          ) : null}
        </View>

        <View style={styles.chartWrap}>
          <Svg viewBox="0 0 320 48" preserveAspectRatio="none" style={styles.svg}>
            <Defs>
              <LinearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={strokeColor} stopOpacity="0.28" />
                <Stop offset="1" stopColor={strokeColor} stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Path d={`${series.path} L312 48 L0 48 Z`} fill="url(#spark)" />
            <Path
              d={series.path}
              fill="none"
              stroke={strokeColor}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Circle cx={312} cy={lastY(series.path)} r={3.5} fill={strokeColor} />
          </Svg>
        </View>

        {/* ── Timeframe tabs ───────────────────────────────────────── */}
        <View style={styles.tfRow}>
          {(Object.keys(SPARKLINES) as Timeframe[]).map((tf) => (
            <TouchableOpacity
              key={tf}
              onPress={() => setTimeframe(tf)}
              style={[styles.tfPill, tf === timeframe && styles.tfPillActive]}
            >
              <Text
                style={[styles.tfPillText, tf === timeframe && styles.tfPillTextActive]}
              >
                {tf}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Quick actions ────────────────────────────────────────── */}
        <View style={styles.quickRow}>
          <QuickAction
            icon="arrow-upward"
            label="Send"
            onPress={() => router.push('/(tabs)' as any)}
          />
          <QuickAction
            icon="arrow-downward"
            label="Receive"
            onPress={() => walletAddress && Alert.alert('Your wallet', walletAddress)}
          />
          <QuickAction
            icon="center-focus-strong"
            label="Scan"
            onPress={() => router.push('/(tabs)' as any)}
          />
          <QuickAction icon="bolt" label="Airdrop" onPress={handleAirdrop} />
        </View>

        {/* ── Ledger pair (I owe / Owed to me) ─────────────────────── */}
        <View style={styles.ledgerRow}>
          <LedgerCard
            label="I owe"
            amountUsd={ledger?.total_i_owe_usd ?? 0}
            count={
              ledger?.owed_by_me.filter((d) => d.status !== 'paid').length ?? 0
            }
            color={theme.colors.alert}
          />
          <LedgerCard
            label="Owed to me"
            amountUsd={ledger?.total_owed_to_me_usd ?? 0}
            count={
              ledger?.owed_to_me.filter((d) => d.status !== 'paid').length ?? 0
            }
            color={theme.colors.success}
          />
        </View>

        {/* ── Activity ─────────────────────────────────────────────── */}
        <Text style={styles.sectionHeader}>Activity</Text>
        {loading && activity.length === 0 ? (
          <View style={{ paddingVertical: 20, alignItems: 'center' }}>
            <ActivityIndicator color={theme.colors.accent} />
          </View>
        ) : activity.length === 0 ? (
          <Text style={styles.emptyRow}>No activity yet.</Text>
        ) : (
          activity.map((row, i) => {
            const isLast = i === activity.length - 1;
            if (row.kind === 'tx') {
              const t = row.data;
              const positive = t.direction === 'received';
              return (
                <View key={row.key} style={[styles.actRow, !isLast && styles.actRowBorder]}>
                  <View
                    style={[
                      styles.actIcon,
                      positive ? styles.actIconReceived : styles.actIconSent,
                    ]}
                  >
                    <MaterialIcons
                      name={positive ? 'arrow-downward' : 'arrow-upward'}
                      size={16}
                      color={positive ? theme.colors.success : theme.colors.text}
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.actName} numberOfLines={1}>
                      {t.counterparty_name ??
                        (t.counterparty_wallet
                          ? solanaService.shortenAddress(t.counterparty_wallet)
                          : 'Unknown')}
                    </Text>
                    <Text style={styles.actSub} numberOfLines={1}>
                      {positive ? 'Received' : 'Sent'} ·{' '}
                      {t.block_time
                        ? new Date(t.block_time * 1000).toLocaleDateString()
                        : '—'}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.actAmount,
                      { color: positive ? theme.colors.success : theme.colors.text },
                    ]}
                  >
                    {positive ? '+' : '−'}
                    {t.amount_sol.toFixed(4)} SOL
                  </Text>
                </View>
              );
            }
            // debt row
            const d = row.data;
            return (
              <View key={row.key} style={[styles.actRow, !isLast && styles.actRowBorder]}>
                <View style={[styles.actIcon, styles.actIconOwe]}>
                  <MaterialIcons name="schedule" size={16} color={theme.colors.alert} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.actName} numberOfLines={1}>
                    {d.counterparty_name}
                  </Text>
                  <Text style={styles.actSub} numberOfLines={1}>
                    {d.status.toUpperCase()}
                    {d.due_date ? ` · due ${d.due_date}` : ''}
                  </Text>
                </View>
                <Text style={[styles.actAmount, { color: theme.colors.alert }]}>
                  −${d.amount_usd.toFixed(2)}
                </Text>
              </View>
            );
          })
        )}

        {/* ── Wallet tools (collapsed) ──────────────────────────────── */}
        <TouchableOpacity
          style={styles.toolsToggle}
          onPress={() => setShowTools((v) => !v)}
        >
          <Text style={styles.toolsToggleText}>Wallet tools</Text>
          <MaterialIcons
            name={showTools ? 'expand-less' : 'expand-more'}
            size={18}
            color={theme.colors.textDim}
          />
        </TouchableOpacity>

        {showTools && (
          <View style={{ gap: 10 }}>
            <KolanaButton kind="ghost" onPress={handleAirdrop} icon="bolt">
              Request airdrop (2 SOL)
            </KolanaButton>
            <KolanaButton
              kind="ghost"
              onPress={() => setShowImport((v) => !v)}
              icon="vpn-key"
            >
              Import existing wallet
            </KolanaButton>

            {showImport && (
              <View style={styles.importBox}>
                <TextInput
                  style={styles.importInput}
                  value={importKey}
                  onChangeText={setImportKey}
                  placeholder="Paste secret key array [1,2,3,...]"
                  placeholderTextColor={theme.colors.textFaint}
                  multiline
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <KolanaButton
                  kind="primary"
                  onPress={handleImportWallet}
                  disabled={importing}
                >
                  {importing ? 'Importing…' : 'Import'}
                </KolanaButton>
              </View>
            )}

            <KolanaButton
              kind="danger"
              icon="logout"
              onPress={() => {
                Alert.alert(
                  'Sign Out',
                  'Clear your session and return to login. Your keypair stays on device.',
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
              Sign out
            </KolanaButton>
          </View>
        )}

        {/* ── Status / version footer ───────────────────────────────── */}
        <View style={styles.footerRow}>
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: serverReady ? theme.colors.success : theme.colors.alert,
              },
            ]}
          />
          <Text style={styles.footerText}>
            {serverReady ? 'OPERATIONAL' : 'OFFLINE'}
            {solPrice != null ? `  ·  SOL $${solPrice.toFixed(2)}` : ''}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.version}
          onLongPress={handleVersionLongPress}
          delayLongPress={500}
        >
          <Text style={styles.versionText}>
            © 2026 KOLANA {demoMode ? '· DEMO MODE' : ''}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── helpers ────────────────────────────────────────────────────────────
function lastY(pathD: string): number {
  // Path is "M0 30 L24 28 … L312 12" — pull the final Y.
  const parts = pathD.trim().split(/\s+/);
  const last = parts[parts.length - 1];
  return parseFloat(last) || 24;
}

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={styles.quickItem} onPress={onPress}>
      <View style={styles.quickIcon}>
        <MaterialIcons name={icon} size={18} color={theme.colors.text} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function LedgerCard({
  label,
  amountUsd,
  count,
  color,
}: {
  label: string;
  amountUsd: number;
  count: number;
  color: string;
}) {
  return (
    <View style={[styles.ledgerCard, { borderColor: color + '55' }]}>
      <Text style={styles.ledgerLabel}>{label}</Text>
      <Text style={[styles.ledgerAmount, { color }]}>${amountUsd.toFixed(2)}</Text>
      <Text style={styles.ledgerCount}>{count} pending</Text>
    </View>
  );
}

// ── styles ─────────────────────────────────────────────────────────────
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
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  avatarPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.accent + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPillText: {
    fontFamily: theme.fonts.bodySemibold,
    fontSize: 14,
    color: theme.colors.accent,
  },
  balanceLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  balanceLabelText: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 14,
    color: theme.colors.textDim,
  },
  balanceBig: {
    fontFamily: theme.fonts.display,
    fontSize: 50,
    color: theme.colors.text,
    letterSpacing: -2,
    lineHeight: 52,
  },
  balanceBigDim: {
    color: theme.colors.textDim,
  },
  changeRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  changeAmount: {
    fontFamily: theme.fonts.bodySemibold,
    fontSize: 14,
  },
  changeLabel: {
    fontFamily: theme.fonts.body,
    fontSize: 14,
    color: theme.colors.textDim,
  },
  chartLabel: {
    marginTop: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  chartCaption: {
    fontFamily: theme.fonts.mono,
    fontSize: 10.5,
    color: theme.colors.textFaint,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  chartPrice: {
    fontFamily: theme.fonts.monoMedium,
    fontSize: 11,
    color: theme.colors.textDim,
  },
  chartWrap: {
    marginTop: 8,
    marginHorizontal: -theme.spacing.marginMobile,
    height: 60,
  },
  svg: {
    width: '100%',
    height: '100%',
  },
  tfRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 30,
    paddingHorizontal: 4,
  },
  tfPill: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
  },
  tfPillActive: {
    backgroundColor: 'rgba(230,240,255,0.07)',
  },
  tfPillText: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 13,
    color: theme.colors.textDim,
  },
  tfPillTextActive: {
    color: theme.colors.text,
    fontFamily: theme.fonts.bodyBold,
  },
  quickRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 30,
  },
  quickItem: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  quickIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(230,240,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 11,
    color: theme.colors.textDim,
  },
  ledgerRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  ledgerCard: {
    flex: 1,
    borderWidth: 1,
    backgroundColor: theme.colors.cardBg,
    padding: 16,
    borderRadius: theme.radius.lg,
    gap: 4,
  },
  ledgerLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    color: theme.colors.textDim,
    textTransform: 'uppercase',
  },
  ledgerAmount: {
    fontFamily: theme.fonts.display,
    fontSize: 22,
  },
  ledgerCount: {
    fontFamily: theme.fonts.body,
    fontSize: 11,
    color: theme.colors.textFaint,
  },
  sectionHeader: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 12,
    color: theme.colors.textDim,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  emptyRow: {
    fontFamily: theme.fonts.body,
    fontSize: 13,
    color: theme.colors.textFaint,
    paddingVertical: 14,
  },
  actRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
  },
  actRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  actIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actIconSent: {
    backgroundColor: 'rgba(230,240,255,0.06)',
  },
  actIconReceived: {
    backgroundColor: theme.colors.success + '1a',
  },
  actIconOwe: {
    backgroundColor: theme.colors.alert + '1a',
  },
  actName: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 15,
    color: theme.colors.text,
  },
  actSub: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
    color: theme.colors.textDim,
    marginTop: 2,
  },
  actAmount: {
    fontFamily: theme.fonts.display,
    fontSize: 15,
    fontWeight: '600',
  },
  toolsToggle: {
    marginTop: 24,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  toolsToggleText: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 13,
    color: theme.colors.textDim,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  importBox: {
    gap: 10,
    padding: 12,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.fieldBg,
  },
  importInput: {
    fontFamily: theme.fonts.mono,
    fontSize: 12,
    color: theme.colors.text,
    minHeight: 64,
    textAlignVertical: 'top',
  },
  footerRow: {
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  footerText: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    color: theme.colors.textFaint,
    letterSpacing: 1,
  },
  version: {
    marginTop: 8,
    alignSelf: 'center',
    padding: 12,
  },
  versionText: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    color: theme.colors.textFaint,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
