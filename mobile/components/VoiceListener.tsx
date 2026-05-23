import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { useState, useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import Colors from '@/constants/Colors';
import { useAppStore } from '@/store/appStore';
import { MIC_TIMEOUT_MS } from '@/constants/timing';

type Props = {
  onAmountConfirmed: (amount: number) => void;
  onCancel: () => void;
  isListening: boolean;
  transcript: string;
  parsedAmount: number | null;
  contactName: string;
};

export function VoiceListener({
  onAmountConfirmed,
  onCancel,
  isListening,
  transcript,
  parsedAmount,
  contactName,
}: Props) {
  const [showKeypad, setShowKeypad] = useState(false);
  const [keypadValue, setKeypadValue] = useState('');
  const [confirmingAmount, setConfirmingAmount] = useState<number | null>(null);

  const pulseScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0.4);

  useEffect(() => {
    if (isListening) {
      pulseScale.value = withRepeat(
        withTiming(1.3, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
      ringOpacity.value = withRepeat(
        withTiming(0.1, { duration: 800 }),
        -1,
        true,
      );
    } else {
      pulseScale.value = withTiming(1);
      ringOpacity.value = withTiming(0.4);
    }
  }, [isListening]);

  useEffect(() => {
    if (parsedAmount !== null) {
      setConfirmingAmount(parsedAmount);
    }
  }, [parsedAmount]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: ringOpacity.value,
  }));

  const handleKeypadSubmit = () => {
    const val = parseFloat(keypadValue);
    if (!isNaN(val) && val > 0) {
      setConfirmingAmount(val);
    }
  };

  if (confirmingAmount !== null) {
    return (
      <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.container}>
        <Text style={styles.confirmLabel}>Pay {contactName}</Text>
        <Text style={styles.confirmAmount}>${confirmingAmount.toFixed(2)}</Text>
        <View style={styles.confirmActions}>
          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={() => onAmountConfirmed(confirmingAmount)}
          >
            <Text style={styles.confirmBtnText}>Confirm</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => {
              setConfirmingAmount(null);
              setShowKeypad(true);
            }}
          >
            <Text style={styles.cancelBtnText}>Change</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  }

  if (showKeypad) {
    return (
      <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.container}>
        <Text style={styles.keypadLabel}>Enter amount</Text>
        <View style={styles.keypadInputRow}>
          <Text style={styles.dollar}>$</Text>
          <TextInput
            style={styles.keypadInput}
            keyboardType="decimal-pad"
            value={keypadValue}
            onChangeText={setKeypadValue}
            placeholder="0.00"
            placeholderTextColor="#555"
            autoFocus
          />
        </View>
        <View style={styles.confirmActions}>
          <TouchableOpacity style={styles.confirmBtn} onPress={handleKeypadSubmit}>
            <Text style={styles.confirmBtnText}>Continue</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.container}>
      <View style={styles.micSection}>
        <Animated.View style={[styles.micRing, pulseStyle]} />
        <View style={[styles.micDot, isListening && styles.micDotActive]} />
      </View>

      <Text style={styles.status}>
        {isListening ? 'Listening...' : 'Tap mic to speak'}
      </Text>

      {transcript ? (
        <View style={styles.transcriptBox}>
          <Text style={styles.transcript}>"{transcript}"</Text>
        </View>
      ) : null}

      <View style={styles.bottomRow}>
        <TouchableOpacity style={styles.keypadToggle} onPress={() => setShowKeypad(true)}>
          <Text style={styles.keypadToggleText}>Use keypad</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelSmall} onPress={onCancel}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#111',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  micSection: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  micRing: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: Colors.palette.cyan400,
  },
  micDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#333',
  },
  micDotActive: {
    backgroundColor: Colors.palette.cyan500,
  },
  status: {
    color: '#888',
    fontSize: 14,
    marginBottom: 12,
  },
  transcriptBox: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    width: '100%',
  },
  transcript: {
    color: '#ccc',
    fontSize: 15,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  bottomRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  keypadToggle: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  keypadToggleText: {
    color: '#aaa',
    fontSize: 14,
  },
  cancelSmall: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  confirmLabel: {
    color: '#888',
    fontSize: 14,
    marginBottom: 8,
  },
  confirmAmount: {
    color: '#fff',
    fontSize: 42,
    fontWeight: '800',
    marginBottom: 24,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmBtn: {
    flex: 1,
    backgroundColor: Colors.palette.cyan500,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#333',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#888',
    fontSize: 15,
  },
  keypadLabel: {
    color: '#888',
    fontSize: 15,
    marginBottom: 16,
  },
  keypadInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dollar: {
    color: '#666',
    fontSize: 36,
    fontWeight: '700',
    marginRight: 4,
  },
  keypadInput: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '700',
    minWidth: 120,
    textAlign: 'center',
  },
});
