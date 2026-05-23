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
import { router } from 'expo-router';
import { useAppStore } from '@/store/appStore';
import { useWallet } from '@/hooks/useWallet';
import { WalletBalance } from '@/components/WalletBalance';
import { TopAppBar } from '@/components/ui/TopAppBar';
import { solanaService } from '@/services/solana';
import { theme } from '@/constants/theme';
import { useState, useCallback } from 'react';

export default function ProfileScreen() {
  const {
    userName,
    walletAddress,
    walletBalanceSol,
    solPrice,
    demoMode,
    toggleDemoMode,
    serverReady,
    debts,
    transactions,
  } = useAppStore();

  const { refreshBalance } = useWallet();
  const [longPressCount, setLongPressCount] = useState(0);
  const [importKey, setImportKey] = useState('');
  const [importing, setImporting] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const pendingDebtCount = debts.filter((d) => d.status === 'pending').length;
  const totalPaid = transactions
    .filter((t) => t.status === 'confirmed')
    .reduce((sum, t) => sum + t.amountUsd, 0);

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
            <Text style={styles.statValue}>{transactions.length}</Text>
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
  backBtn: {
    marginTop: 24,
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
});
