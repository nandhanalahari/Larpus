import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useEffect, useRef } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import { theme } from '@/constants/theme';

type FaceBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Props = {
  faces: FaceBounds[];
  selectedIndex: number | null;
  onSelectFace: (index: number) => void;
  isRecognizing: boolean;
  confidence: number;
  cameraWidth: number;
  cameraHeight: number;
};

export function FaceOverlay({
  faces,
  selectedIndex,
  onSelectFace,
  isRecognizing,
  confidence,
  cameraWidth,
  cameraHeight,
}: Props) {
  const pulseAnim = useSharedValue(1);

  useEffect(() => {
    if (isRecognizing) {
      pulseAnim.value = withRepeat(
        withTiming(1.08, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      pulseAnim.value = withTiming(1);
    }
  }, [isRecognizing]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  if (faces.length === 0) return null;

  return (
    <View style={[styles.container, { width: cameraWidth, height: cameraHeight }]}>
      {faces.map((face, i) => {
        const isSelected = selectedIndex === i;
        const borderColor = isSelected
          ? isRecognizing
            ? theme.colors.accent
            : theme.colors.tertiary
          : theme.colors.primary;

        return (
          <TouchableOpacity
            key={i}
            activeOpacity={0.8}
            onPress={() => onSelectFace(i)}
            style={[
              styles.faceBox,
              {
                left: face.x,
                top: face.y,
                width: face.width,
                height: face.height,
                borderColor,
                borderWidth: isSelected ? 2.5 : 1.5,
              },
            ]}
          >
            {isSelected && isRecognizing && (
              <Animated.View style={[styles.cornerTL, pulseStyle, { borderColor }]} />
            )}
            {isSelected && isRecognizing && (
              <Animated.View style={[styles.cornerTR, pulseStyle, { borderColor }]} />
            )}
            {isSelected && isRecognizing && (
              <Animated.View style={[styles.cornerBL, pulseStyle, { borderColor }]} />
            )}
            {isSelected && isRecognizing && (
              <Animated.View style={[styles.cornerBR, pulseStyle, { borderColor }]} />
            )}
          </TouchableOpacity>
        );
      })}

      {faces.length > 1 && selectedIndex === null && (
        <View style={styles.hint}>
          <Text style={styles.hintText}>Tap a face to select</Text>
        </View>
      )}
    </View>
  );
}

const CORNER = 20;
const CORNER_W = 3;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  faceBox: {
    position: 'absolute',
    borderRadius: 8,
    borderStyle: 'dashed',
  },
  cornerTL: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: CORNER,
    height: CORNER,
    borderTopWidth: CORNER_W,
    borderLeftWidth: CORNER_W,
    borderTopLeftRadius: 8,
  },
  cornerTR: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: CORNER,
    height: CORNER,
    borderTopWidth: CORNER_W,
    borderRightWidth: CORNER_W,
    borderTopRightRadius: 8,
  },
  cornerBL: {
    position: 'absolute',
    bottom: -2,
    left: -2,
    width: CORNER,
    height: CORNER,
    borderBottomWidth: CORNER_W,
    borderLeftWidth: CORNER_W,
    borderBottomLeftRadius: 8,
  },
  cornerBR: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: CORNER,
    height: CORNER,
    borderBottomWidth: CORNER_W,
    borderRightWidth: CORNER_W,
    borderBottomRightRadius: 8,
  },
  hint: {
    position: 'absolute',
    bottom: 120,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  hintText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});
