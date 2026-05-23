import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { solanaService } from '@/services/solana';

type Props = {
  balanceSol: number;
  solPrice: number | null;
  walletAddress: string | null;
  onRefresh: () => void;
};

export function WalletBalance({
  balanceSol,
  solPrice,
  walletAddress,
  onRefresh,
}: Props) {
  const usdValue = solPrice ? (balanceSol * solPrice).toFixed(2) : '—';
  const shortAddr = walletAddress
    ? solanaService.shortenAddress(walletAddress)
    : '—';

  return (
    <View style={styles.container}>
      <View style={styles.balanceRow}>
        <View>
          <Text style={styles.label}>Wallet Balance</Text>
          <Text style={styles.sol}>{balanceSol.toFixed(4)} SOL</Text>
          <Text style={styles.usd}>~${usdValue} USDC</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
          <MaterialIcons
            name="refresh"
            size={20}
            color={theme.colors.tertiary}
          />
        </TouchableOpacity>
      </View>
      <Text style={styles.address}>{shortAddr}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
    backgroundColor: theme.colors.surfaceContainerLowest,
    padding: 20,
    marginBottom: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  label: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: theme.colors.onSurfaceVariant,
    marginBottom: 8,
  },
  sol: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.primary,
    letterSpacing: -0.5,
  },
  usd: {
    fontFamily: theme.fonts.mono,
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    marginTop: 4,
  },
  address: {
    fontFamily: theme.fonts.mono,
    fontSize: 12,
    color: theme.colors.onPrimaryContainer,
    marginTop: 12,
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
});
