import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';

const BAR_COUNT = 13;

export function VoiceWaveform({ active }: { active: boolean }) {
  const [heights, setHeights] = useState(() =>
    Array.from({ length: BAR_COUNT }, (_, i) => 8 + (i % 4) * 4),
  );

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setHeights(
        Array.from({ length: BAR_COUNT }, () => 4 + Math.floor(Math.random() * 24)),
      );
    }, 280);
    return () => clearInterval(id);
  }, [active]);

  return (
    <View style={styles.row}>
      {heights.map((h, i) => (
        <View key={i} style={[styles.bar, { height: h }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    height: 32,
    gap: 3,
    maxWidth: 280,
    alignSelf: 'center',
  },
  bar: {
    width: 2,
    backgroundColor: theme.colors.primary,
    borderRadius: 1,
  },
});
