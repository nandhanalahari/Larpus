import { View, Text, StyleSheet, TouchableOpacity, Alert, SafeAreaView, ScrollView } from 'react-native';
import { useAppStore } from '@/store/appStore';
import { useWallet } from '@/hooks/useWallet';
import { WalletBalance } from '@/components/WalletBalance';
import { solanaService } from '@/services/solana';
import Colors from '@/constants/Colors';
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
      Alert.alert('Airdrop Failed', 'Devnet faucet may be rate-limited. Try again later.');
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Profile</Text>

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
            <Text style={[styles.statValue, pendingDebtCount > 0 && { color: Colors.palette.yellow400 }]}>
              {pendingDebtCount}
            </Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.actionBtn} onPress={handleAirdrop}>
          <Text style={styles.actionIcon}>{'\u2B50'}</Text>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Request Airdrop</Text>
            <Text style={styles.actionDesc}>Get 2 SOL from devnet faucet</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.serverStatus}>
          <View style={[styles.statusDot, { backgroundColor: serverReady ? Colors.palette.green400 : Colors.palette.red400 }]} />
          <Text style={styles.serverText}>
            Server {serverReady ? 'Connected' : 'Offline'}
          </Text>
        </View>

        {solPrice && (
          <Text style={styles.priceText}>
            SOL/USD: ${solPrice.toFixed(2)}
          </Text>
        )}

        <TouchableOpacity
          style={styles.version}
          onLongPress={handleVersionLongPress}
          delayLongPress={500}
        >
          <Text style={styles.versionText}>
            CIPHER v1.0 {demoMode ? '(DEMO MODE)' : ''}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scroll: {
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
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
    backgroundColor: Colors.palette.cyan600,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '700',
  },
  name: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  statLabel: {
    color: '#666',
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    gap: 14,
  },
  actionIcon: {
    fontSize: 24,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  actionDesc: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  serverStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    alignSelf: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  serverText: {
    color: '#666',
    fontSize: 13,
  },
  priceText: {
    color: '#555',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    fontFamily: 'SpaceMono',
  },
  version: {
    marginTop: 24,
    alignSelf: 'center',
    padding: 12,
  },
  versionText: {
    color: '#333',
    fontSize: 12,
  },
});
