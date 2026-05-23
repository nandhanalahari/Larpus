import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { theme } from '@/constants/theme';
import { VoiceWaveform } from './VoiceWaveform';
import { CipherIcon } from './ui/CipherIcon';
import { useAppStore } from '@/store/appStore';

type Props = {
  onAmountConfirmed: (amount: number, dueDate?: string | null) => void;
  onCancel: () => void;
  isListening: boolean;
  transcript: string;
  parsedAmount: number | null;
  parsedDueDate: string | null;
  contactName: string;
  onStartListening: () => void;
  onStopListening: () => void;
};

export function VoiceListener({
  onAmountConfirmed,
  onCancel,
  isListening,
  transcript,
  parsedAmount,
  parsedDueDate,
  contactName,
  onStartListening,
  onStopListening,
}: Props) {
  const [showKeypad, setShowKeypad] = useState(false);
  const [keypadValue, setKeypadValue] = useState('');
  const [confirmingAmount, setConfirmingAmount] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // Reset parsed voice state when mounting to prevent stale data from auto-confirming
    useAppStore.getState().setParsedAmount(null);
    useAppStore.getState().setParsedDueDate(null);
    setConfirmingAmount(null);
  }, []);

  const handleStop = async () => {
    setIsProcessing(true);
    try {
      await onStopListening();
    } catch (err) {
      console.warn('[VoiceListener] stop failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (parsedAmount !== null) {
      setConfirmingAmount(parsedAmount);
    }
  }, [parsedAmount]);

  const displayIntent =
    confirmingAmount !== null
      ? parsedDueDate
        ? `Schedule $${confirmingAmount.toFixed(0)} to ${contactName.split(' ')[0]} by ${parsedDueDate}`
        : `Pay ${contactName.split(' ')[0]} $${confirmingAmount.toFixed(0)}`
      : transcript
        ? transcript
        : isListening
          ? 'Listening… (Speak payment amount)'
          : 'Tap "Start Recording" and state the amount to pay';

  if (confirmingAmount !== null && !showKeypad) {
    return (
      <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.wrap}>
        <View style={styles.intentBox}>
          <Text style={styles.intentLabel}>
            {parsedDueDate ? 'Schedule Payment' : 'Intent Detected'}
          </Text>
          {parsedDueDate ? (
            <Text style={styles.intentHeadline}>
              Schedule ${confirmingAmount.toFixed(0)} to {contactName.split(' ')[0]} by {parsedDueDate}
            </Text>
          ) : (
            <Text style={styles.intentAmount}>
              <Text style={styles.payWord}>Pay </Text>
              ${confirmingAmount.toFixed(0)}
            </Text>
          )}
        </View>
        <VoiceWaveform active={false} />
        <View style={styles.confirmRow}>
          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={() => onAmountConfirmed(confirmingAmount, parsedDueDate)}
          >
            <Text style={styles.confirmBtnText}>
              {parsedDueDate ? 'Confirm Schedule' : 'Confirm Payment'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.changeBtn}
            onPress={() => {
              setConfirmingAmount(null);
              setShowKeypad(true);
            }}
          >
            <Text style={styles.changeBtnText}>Change</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  }

  if (showKeypad) {
    return (
      <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.wrap}>
        <View style={styles.intentBox}>
          <Text style={styles.intentLabel}>Enter amount</Text>
          <View style={styles.keypadRow}>
            <Text style={styles.dollar}>$</Text>
            <TextInput
              style={styles.keypadInput}
              keyboardType="decimal-pad"
              value={keypadValue}
              onChangeText={setKeypadValue}
              placeholder="0"
              placeholderTextColor={theme.colors.onPrimaryContainer}
              autoFocus
            />
          </View>
        </View>
        <TouchableOpacity
          style={styles.confirmBtn}
          onPress={() => {
            const val = parseFloat(keypadValue);
            if (!isNaN(val) && val > 0) {
              setConfirmingAmount(val);
              setShowKeypad(false);
            }
          }}
        >
          <Text style={styles.confirmBtnText}>Continue</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.changeBtn} onPress={() => setShowKeypad(false)}>
          <Text style={styles.changeBtnText}>Back</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.wrap}>
      <View style={styles.intentBox}>
        <Text style={styles.intentLabel}>Captured Intent</Text>
        <Text style={styles.intentHeadline}>{displayIntent}</Text>
      </View>
      <VoiceWaveform active={isListening} />

      <TouchableOpacity
        style={[
          styles.recordBtn,
          isListening ? styles.recordBtnActive : styles.recordBtnInactive,
          isProcessing && styles.recordBtnProcessing,
        ]}
        onPress={isListening ? handleStop : onStartListening}
        disabled={isProcessing}
      >
        {isProcessing ? (
          <ActivityIndicator size="small" color={theme.colors.tertiary} />
        ) : (
          <CipherIcon
            name={isListening ? 'stop' : 'mic'}
            size={20}
            color={isListening ? theme.colors.error : theme.colors.tertiary}
          />
        )}
        <Text
          style={[
            styles.recordBtnText,
            isListening ? styles.recordTextActive : styles.recordTextInactive,
            isProcessing && styles.recordTextProcessing,
          ]}
        >
          {isProcessing ? 'Processing voice...' : isListening ? 'Stop & Process' : 'Start Recording'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.keypadLink}
        onPress={() => setShowKeypad(true)}
      >
        <Text style={styles.keypadLinkText}>Use keypad</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelPaymentBtn} onPress={onCancel}>
        <Text style={styles.cancelPaymentBtnText}>Cancel</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 96,
    left: theme.spacing.marginMobile,
    right: theme.spacing.marginMobile,
    alignItems: 'center',
    gap: 20,
  },
  intentBox: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: theme.colors.panelBg,
    borderWidth: 1,
    borderColor: theme.colors.hardBorder,
    padding: 24,
    alignItems: 'center',
  },
  intentLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: theme.colors.onSurfaceVariant,
    marginBottom: 8,
  },
  intentHeadline: {
    fontSize: 24,
    fontWeight: '600',
    color: theme.colors.primary,
    textAlign: 'center',
  },
  intentAmount: {
    fontSize: 48,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  payWord: {
    color: theme.colors.tertiary,
  },
  keypadRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dollar: {
    fontSize: 32,
    color: theme.colors.onSurfaceVariant,
    marginRight: 4,
  },
  keypadInput: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.colors.primary,
    minWidth: 80,
    textAlign: 'center',
  },
  confirmRow: {
    width: '100%',
    gap: 10,
  },
  confirmBtn: {
    width: '100%',
    height: 56,
    backgroundColor: theme.colors.tertiary,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    fontFamily: theme.fonts.mono,
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.onTertiary,
  },
  changeBtn: {
    width: '100%',
    height: 48,
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.default,
  },
  changeBtnText: {
    fontFamily: theme.fonts.mono,
    fontSize: 14,
    color: theme.colors.onSurface,
  },
  keypadLink: {
    paddingVertical: 4,
  },
  keypadLinkText: {
    fontFamily: theme.fonts.mono,
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
  },
  recordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    height: 56,
    borderWidth: 1,
    borderRadius: 999,
    marginTop: 8,
  },
  recordBtnActive: {
    backgroundColor: `${theme.colors.error}1A`,
    borderColor: theme.colors.error,
  },
  recordBtnInactive: {
    backgroundColor: `${theme.colors.tertiary}1A`,
    borderColor: theme.colors.tertiary,
  },
  recordBtnText: {
    fontFamily: theme.fonts.mono,
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  recordTextActive: {
    color: theme.colors.error,
  },
  recordTextInactive: {
    color: theme.colors.tertiary,
  },
  recordBtnProcessing: {
    backgroundColor: `${theme.colors.surfaceContainerHigh}80`,
    borderColor: theme.colors.outline,
  },
  recordTextProcessing: {
    color: theme.colors.outline,
  },
  cancelPaymentBtn: {
    width: '100%',
    height: 48,
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.default,
  },
  cancelPaymentBtnText: {
    fontFamily: theme.fonts.mono,
    fontSize: 14,
    color: theme.colors.onSurface,
  },
});
