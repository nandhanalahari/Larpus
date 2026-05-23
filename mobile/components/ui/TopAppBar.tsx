import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { KolanaIcon } from './KolanaIcon';
import { theme } from '@/constants/theme';

type Props = {
  onWalletPress?: () => void;
  onSettingsPress?: () => void;
  showWallet?: boolean;
  showSettings?: boolean;
};

export function TopAppBar({
  onWalletPress,
  onSettingsPress,
  showWallet = true,
  showSettings = true,
}: Props) {
  const insets = useSafeAreaInsets();

  const openWallet = () => {
    if (onWalletPress) onWalletPress();
    else router.push('/(tabs)/profile');
  };

  const openSettings = () => {
    if (onSettingsPress) onSettingsPress();
    else router.push('/(tabs)/profile');
  };

  return (
    <View style={[styles.bar, { paddingTop: insets.top }]}>
      {showWallet ? (
        <Pressable
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          onPress={openWallet}
        >
          <KolanaIcon name="account-balance-wallet" size={22} />
        </Pressable>
      ) : (
        <View style={styles.iconPlaceholder} />
      )}

      <Text style={styles.title}>KOLANA</Text>

      {showSettings ? (
        <Pressable
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          onPress={openSettings}
        >
          <KolanaIcon
            name="settings"
            size={22}
            color={theme.colors.onSurfaceVariant}
          />
        </Pressable>
      ) : (
        <View style={styles.iconPlaceholder} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    paddingHorizontal: theme.spacing.marginMobile,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outlineVariant,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: theme.fonts.mono,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 4,
    color: theme.colors.primary,
    textTransform: 'uppercase',
  },
  iconBtn: {
    padding: 8,
    borderRadius: theme.radius.default,
  },
  iconPlaceholder: {
    width: 40,
  },
  pressed: {
    opacity: 0.8,
    backgroundColor: theme.colors.surfaceContainerHigh,
  },
});
