import { View, StyleSheet, Text } from 'react-native';
import { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import Colors from '@/constants/Colors';
import { FACE_CONFIDENCE_HIGH, FACE_CONFIDENCE_LOW } from '@/constants/thresholds';

type Props = {
  confidence: number;
  size?: number;
};

export function ConfidenceRing({ confidence, size = 48 }: Props) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(confidence, { duration: 400 });
  }, [confidence]);

  const fillStyle = useAnimatedStyle(() => ({
    height: `${Math.min(progress.value * 100, 100)}%`,
  }));

  const color =
    confidence >= FACE_CONFIDENCE_HIGH
      ? Colors.palette.green400
      : confidence >= FACE_CONFIDENCE_LOW
        ? Colors.palette.yellow400
        : Colors.palette.red400;

  const pct = Math.round(confidence * 100);

  return (
    <View style={[styles.container, { width: size, height: size, borderColor: color }]}>
      <Animated.View style={[styles.fill, fillStyle, { backgroundColor: color }]} />
      <Text style={[styles.text, { fontSize: size * 0.28 }]}>{pct}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 100,
    borderWidth: 2.5,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    opacity: 0.25,
  },
  text: {
    fontWeight: '700',
    color: '#fff',
  },
});
