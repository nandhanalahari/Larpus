/**
 * PaymentStatus — Variant A Robinhood-minimal.
 *
 * Big circular status badge, huge USD amount, status label, sub line, then
 * detail rows (Amount in SOL · Date). Single CTA. No table chrome, no
 * signature display (those still ride along in props for downstream use).
 */
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import { KolanaButton } from '@/components/ui/kolana';
import { theme } from '@/constants/theme';

type Status = 'sending' | 'confirmed' | 'failed' | 'pending' | 'scheduled';

type Props = {
  status: Status;
  amountUsd: number;
  amountSol?: number;
  contactName: string;
  txSignature?: string;
  dueDate?: string | null;
  note?: string | null;
  error?: string;
  onRetry?: () => void;
  onDismiss: () => void;
};

const STATUS_META: Record<
  Status,
  { label: string; icon: keyof typeof MaterialIcons.glyphMap; color: (t: typeof theme.colors) => string }
> = {
  sending:   { label: 'Sending',          icon: 'bolt',              color: (c) => c.text },
  confirmed: { label: 'Sent',             icon: 'check',             color: (c) => c.success },
  scheduled: { label: 'Scheduled',        icon: 'calendar-today',    color: (c) => c.accent },
  pending:   { label: 'Saved for later',  icon: 'hourglass-empty',   color: (c) => c.warning },
  failed:    { label: 'Failed',           icon: 'close',             color: (c) => c.alert },
};

export function PaymentStatus({
  status,
  amountUsd,
  amountSol,
  contactName,
  dueDate,
  note,
  error,
  onRetry,
  onDismiss,
}: Props) {
  const meta = STATUS_META[status];
  const accentColor = meta.color(theme.colors);

  const dueFormatted = dueDate
    ? new Date(dueDate).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : null;

  const sub =
    status === 'scheduled' && dueFormatted
      ? `to ${contactName} · due ${dueFormatted}`
      : status === 'pending'
        ? 'Insufficient balance · queued'
        : status === 'failed'
          ? error ?? 'Network error'
          : `to ${contactName}`;

  const dollars = Math.floor(amountUsd);
  const cents = (amountUsd % 1).toFixed(2).slice(2) || '00';

  return (
    <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.overlay}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Top utility row */}
        <View style={styles.topRow}>
          <TouchableOpacity onPress={onDismiss} hitSlop={10} style={{ padding: 6 }}>
            <MaterialIcons name="close" size={20} color={theme.colors.textDim} />
          </TouchableOpacity>
        </View>

        {/* ── Hero */}
        <View style={styles.hero}>
          <View
            style={[
              styles.statusCircle,
              { backgroundColor: accentColor + '1f' },
            ]}
          >
            <MaterialIcons name={meta.icon} size={40} color={accentColor} />
          </View>

          <Text style={styles.statusLabel}>{meta.label}</Text>

          <Text style={styles.amountBig}>
            ${dollars}
            <Text style={styles.amountBigDim}>.{cents}</Text>
          </Text>

          <Text style={styles.sub}>{sub}</Text>
        </View>

        {/* ── Detail rows — plain, no bg ─────────────────────────── */}
        <View style={styles.details}>
          <DetailRow
            label="Amount"
            value={
              amountSol != null
                ? `${amountSol.toFixed(4)} SOL`
                : `~${(amountUsd / 150).toFixed(4)} SOL`
            }
          />
          <DetailRow
            label="Date"
            value={new Date().toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
            last={!note}
          />
          {note ? <DetailRow label="Note" value={note} last /> : null}
        </View>

        {/* ── Action ─────────────────────────────────────────────── */}
        <View style={{ marginTop: 28 }}>
          {status === 'failed' && onRetry ? (
            <KolanaButton kind="primary" icon="refresh" onPress={onRetry}>
              Retry
            </KolanaButton>
          ) : status === 'sending' ? (
            <Text style={styles.waiting}>Waiting for network confirmation…</Text>
          ) : (
            <KolanaButton kind="primary" onPress={onDismiss}>
              Done
            </KolanaButton>
          )}
        </View>
      </ScrollView>
    </Animated.View>
  );
}

function DetailRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.detailRow, !last && styles.detailRowBorder]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.bg,
    zIndex: 20,
  },
  scroll: {
    paddingHorizontal: theme.spacing.marginMobile,
    paddingTop: 36,
    paddingBottom: 36,
    flexGrow: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: 8,
  },
  hero: {
    alignItems: 'center',
    paddingTop: 36,
    marginBottom: 36,
  },
  statusCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  statusLabel: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 14,
    color: theme.colors.textDim,
    marginBottom: 10,
  },
  amountBig: {
    fontFamily: theme.fonts.display,
    fontSize: 56,
    color: theme.colors.text,
    letterSpacing: -2.5,
    lineHeight: 58,
  },
  amountBigDim: {
    color: theme.colors.textDim,
  },
  sub: {
    marginTop: 14,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    color: theme.colors.textDim,
    textAlign: 'center',
  },
  details: {},
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  detailRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  detailLabel: {
    fontFamily: theme.fonts.body,
    fontSize: 13.5,
    color: theme.colors.textDim,
  },
  detailValue: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 13.5,
    color: theme.colors.text,
    maxWidth: '60%',
    textAlign: 'right',
  },
  waiting: {
    fontFamily: theme.fonts.body,
    fontSize: 13,
    color: theme.colors.textDim,
    textAlign: 'center',
    paddingVertical: 14,
  },
});
