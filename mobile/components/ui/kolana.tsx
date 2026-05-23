/**
 * KOLANA shared UI primitives — Variant A (soft glass) from the Larpus v2
 * design handoff. Mirrors atoms.jsx + screens-onboarding.jsx helpers.
 *
 * - `Headline` — kicker + huge display title + dim sub
 * - `KolanaField` — labelled text input, rounded, soft fill, eye toggle
 * - `KolanaButton` — primary (cyan) / ghost / danger, 54-tall, 14-rounded
 * - `GlassPanel` — translucent over BlurView, falls back to solid
 * - `StepDots` — progress bar (1 of N)
 */
import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
  TextInputProps,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { theme } from '@/constants/theme';

// ── Headline ────────────────────────────────────────────────────────────
export function Headline({
  kicker,
  title,
  sub,
  style,
}: {
  kicker?: string;
  title: string;
  sub?: string | React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ marginBottom: 28 }, style]}>
      {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {sub ? (
        typeof sub === 'string' ? (
          <Text style={styles.sub}>{sub}</Text>
        ) : (
          <View style={{ marginTop: 10 }}>{sub}</View>
        )
      ) : null}
    </View>
  );
}

// ── KolanaField ─────────────────────────────────────────────────────────
type FieldProps = {
  label?: string;
  value: string;
  onChangeText: (s: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  secureTextEntry?: boolean;
  rightIcon?: keyof typeof MaterialIcons.glyphMap;
  onRightIconPress?: () => void;
  mono?: boolean;
} & Pick<
  TextInputProps,
  | 'autoCapitalize'
  | 'autoComplete'
  | 'keyboardType'
  | 'autoCorrect'
  | 'multiline'
  | 'numberOfLines'
>;

export function KolanaField({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  error,
  secureTextEntry,
  rightIcon,
  onRightIconPress,
  mono,
  ...rest
}: FieldProps) {
  return (
    <View style={{ gap: 8 }}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <View style={styles.fieldWrap}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textFaint}
          secureTextEntry={secureTextEntry}
          style={[
            styles.field,
            mono && { fontFamily: theme.fonts.mono },
            rightIcon ? { paddingRight: 44 } : null,
          ]}
          {...rest}
        />
        {rightIcon ? (
          <TouchableOpacity
            onPress={onRightIconPress}
            hitSlop={10}
            style={styles.fieldRightIcon}
          >
            <MaterialIcons
              name={rightIcon}
              size={20}
              color={theme.colors.textDim}
            />
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? (
        <Text style={styles.fieldError}>{error}</Text>
      ) : hint ? (
        <Text style={styles.fieldHint}>{hint}</Text>
      ) : null}
    </View>
  );
}

// ── KolanaButton ────────────────────────────────────────────────────────
type ButtonKind = 'primary' | 'ghost' | 'danger';

export function KolanaButton({
  kind = 'primary',
  children,
  onPress,
  disabled,
  icon,
  style,
}: {
  kind?: ButtonKind;
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  icon?: keyof typeof MaterialIcons.glyphMap;
  style?: StyleProp<ViewStyle>;
}) {
  const palette = {
    primary: {
      bg: theme.colors.accent,
      fg: theme.colors.onAccent,
      border: 'transparent',
    },
    ghost: {
      bg: 'transparent',
      fg: theme.colors.text,
      border: theme.colors.borderHard,
    },
    danger: {
      bg: 'transparent',
      fg: theme.colors.alert,
      border: theme.colors.alert,
    },
  }[kind];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={[
        styles.btn,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}
    >
      {icon ? (
        <MaterialIcons
          name={icon}
          size={18}
          color={palette.fg}
          style={{ marginRight: 8 }}
        />
      ) : null}
      <Text style={[styles.btnText, { color: palette.fg }]}>{children}</Text>
    </TouchableOpacity>
  );
}

// ── GlassPanel ──────────────────────────────────────────────────────────
export function GlassPanel({
  children,
  style,
  intensity = 24,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
}) {
  return (
    <View style={[styles.glassWrap, style]}>
      <BlurView
        intensity={intensity}
        tint="dark"
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.glassOverlay} />
      <View style={{ padding: theme.spacing.marginMobile }}>{children}</View>
    </View>
  );
}

// ── StepDots ────────────────────────────────────────────────────────────
export function StepDots({ step, total = 3 }: { step: number; total?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 36 }}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 3,
            borderRadius: 2,
            backgroundColor:
              i + 1 <= step
                ? theme.colors.accent
                : 'rgba(230,240,255,0.09)',
          }}
        />
      ))}
    </View>
  );
}

// ── BackButton ──────────────────────────────────────────────────────────
export function KolanaBackButton({ onPress }: { onPress?: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={10}
      style={{ padding: 6, marginLeft: -6 }}
    >
      <MaterialIcons
        name="chevron-left"
        size={26}
        color={theme.colors.textDim}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  kicker: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 12,
    color: theme.colors.textDim,
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: 30,
    fontWeight: '600',
    color: theme.colors.text,
    letterSpacing: -1.2,
    lineHeight: 34,
  } as TextStyle,
  sub: {
    marginTop: 10,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    color: theme.colors.textDim,
    lineHeight: 21,
  },

  fieldLabel: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 13,
    color: theme.colors.textDim,
    paddingLeft: 2,
  },
  fieldWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  field: {
    width: '100%',
    height: 52,
    paddingHorizontal: 18,
    borderRadius: theme.radius.default,
    backgroundColor: theme.colors.fieldBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    color: theme.colors.text,
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 15,
  },
  fieldRightIcon: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  fieldHint: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
    color: theme.colors.textFaint,
    paddingLeft: 4,
  },
  fieldError: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
    color: theme.colors.alert,
    paddingLeft: 4,
  },

  btn: {
    height: 54,
    paddingHorizontal: 22,
    borderRadius: theme.radius.default,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontFamily: theme.fonts.bodySemibold,
    fontSize: 15,
  },

  glassWrap: {
    borderRadius: theme.radius.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.borderHard,
    backgroundColor: theme.colors.cardBg,
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(14,22,36,0.35)',
  },
});
