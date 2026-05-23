import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Colors from '@/constants/Colors';
import { solanaService } from '@/services/solana';

type Props = {
  balanceSol: number;
  solPrice: number | null;
  walletAddress: string | null;
  onRefresh: () => void;
};

export function WalletBalance({ balanceSol, solPrice, walletAddress, onRefresh }: Props) {
  const usdValue = solPrice ? (balanceSol * solPrice).toFixed(2) : '—';
  const shortAddr = walletAddress ? solanaService.shortenAddress(walletAddress) : '—';

  return (
    <View style={styles.container}>
      <View style={styles.balanceRow}>
        <View>
          <Text style={styles.label}>Balance</Text>
          <Text style={styles.sol}>{balanceSol.toFixed(4)} SOL</Text>
          <Text style={styles.usd}>~${usdValue}</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
          <Text style={styles.refreshIcon}>{'\u21BB'}</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.address}>{shortAddr}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  label: {
    color: '#666',
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  sol: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
  },
  usd: {
    color: '#888',
    fontSize: 15,
    marginTop: 2,
  },
  address: {
    color: '#555',
    fontSize: 12,
    fontFamily: 'SpaceMono',
    marginTop: 12,
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshIcon: {
    color: Colors.palette.cyan400,
    fontSize: 20,
  },
});
