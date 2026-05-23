import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TopAppBar } from '@/components/ui/TopAppBar';
import { theme } from '@/constants/theme';
import { useAppStore } from '@/store/appStore';

const UPCOMING = [
  { title: 'Validator Node Rent', date: 'OCT 04', amount: '-15.00 SOL', negative: true },
  { title: 'Staking Reward', date: 'OCT 15', amount: '+5.50 SOL', negative: false },
  { title: 'DEX LP Fee', date: 'OCT 26', amount: '-11.00 SOL', negative: true },
];

const DAYS = [
  ['1', '2', '3', '4', '5', '6', '7'],
  ['8', '9', '10', '11', '12', '13', '14'],
  ['15', '16', '17', '18', '19', '20', '21'],
  ['22', '23', '24', '25', '26', '27', '28'],
  ['29', '30', '31', '1', '2', '3', '4'],
];

const DOT_DAYS = new Set(['4', '15', '26']);
const SELECTED = '12';

export default function CalendarScreen() {
  const { debts, solPrice } = useAppStore();

  const formattedDebts = debts
    .filter((debt) => debt.status === 'pending')
    .map((debt) => {
      const dateObj = new Date(debt.dueDate || debt.createdAt);
      const month = dateObj.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
      const day = String(dateObj.getDate()).padStart(2, '0');
      
      const solAmount = solPrice ? debt.amountUsd / solPrice : 0;
      
      return {
        title: `Pay ${debt.contactName}`,
        date: `${month} ${day}`,
        amount: `-${solAmount.toFixed(2)} SOL`,
        negative: true,
      };
    });

  const allUpcoming = [...formattedDebts, ...UPCOMING];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <TopAppBar />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Schedules</Text>

        <View style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            <Text style={styles.calendarMonth}>October 2023</Text>
            <View style={styles.calendarNav}>
              <Text style={styles.navIcon}>{'‹'}</Text>
              <Text style={styles.navIcon}>{'›'}</Text>
            </View>
          </View>
          <View style={styles.weekRow}>
            {['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].map((d) => (
              <Text key={d} style={styles.weekLabel}>
                {d}
              </Text>
            ))}
          </View>
          {DAYS.map((row, ri) => (
            <View key={ri} style={styles.dayRow}>
              {row.map((day) => {
                const muted = ri === 4 && Number(day) < 10;
                const selected = day === SELECTED;
                const dot = DOT_DAYS.has(day);
                const errorDot = day === '26';
                return (
                  <View key={`${ri}-${day}`} style={styles.dayCell}>
                    <View
                      style={[
                        styles.dayInner,
                        selected && styles.daySelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          muted && styles.dayMuted,
                          selected && styles.dayTextSelected,
                        ]}
                      >
                        {day}
                      </Text>
                      {dot && (
                        <View
                          style={[
                            styles.dot,
                            errorDot && styles.dotError,
                          ]}
                        />
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Scheduled Outflow (Oct)</Text>
          <Text style={styles.summaryAmount}>
            20.50 <Text style={styles.summaryUnit}>SOL</Text>
          </Text>
        </View>

        <View style={styles.listCard}>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>Upcoming Transactions</Text>
          </View>
          {allUpcoming.map((item, i) => (
            <View
              key={`${item.title}-${i}`}
              style={[styles.listRow, i < allUpcoming.length - 1 && styles.listRowBorder]}
            >
              <View>
                <Text style={styles.listName}>{item.title}</Text>
                <Text style={styles.listDate}>{item.date}</Text>
              </View>
              <Text
                style={[
                  styles.listAmount,
                  item.negative ? styles.amountOut : styles.amountIn,
                ]}
              >
                {item.amount}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <Pressable style={styles.fab}>
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.black,
  },
  scroll: {
    paddingHorizontal: theme.spacing.marginMobile,
    paddingBottom: 100,
  },
  pageTitle: {
    fontSize: 48,
    fontWeight: '700',
    color: theme.colors.onSurface,
    letterSpacing: -0.5,
    marginBottom: 24,
    marginTop: 8,
  },
  calendarCard: {
    borderWidth: 1,
    borderColor: theme.colors.hardBorder,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.default,
    marginBottom: theme.spacing.gutter,
    overflow: 'hidden',
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.gutter,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.hardBorder,
    backgroundColor: theme.colors.panelBg,
  },
  calendarMonth: {
    fontFamily: theme.fonts.mono,
    fontSize: 14,
    color: theme.colors.primary,
  },
  calendarNav: {
    flexDirection: 'row',
    gap: 8,
  },
  navIcon: {
    color: theme.colors.onSurfaceVariant,
    fontSize: 18,
  },
  weekRow: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.gutter,
    paddingTop: theme.spacing.gutter,
    marginBottom: 8,
  },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: theme.colors.onSurfaceVariant,
  },
  dayRow: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.gutter,
    marginBottom: 16,
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
  },
  dayInner: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  daySelected: {
    borderWidth: 1,
    borderColor: theme.colors.outline,
    backgroundColor: theme.colors.surfaceContainerHigh,
    borderRadius: theme.radius.default,
  },
  dayText: {
    fontFamily: theme.fonts.mono,
    fontSize: 14,
    color: theme.colors.primary,
  },
  dayTextSelected: {
    fontWeight: '600',
  },
  dayMuted: {
    color: theme.colors.outline,
  },
  dot: {
    position: 'absolute',
    bottom: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.tertiary,
  },
  dotError: {
    backgroundColor: theme.colors.error,
  },
  summaryCard: {
    borderWidth: 1,
    borderColor: theme.colors.hardBorder,
    backgroundColor: theme.colors.surface,
    padding: 24,
    borderRadius: theme.radius.default,
    marginBottom: theme.spacing.gutter,
  },
  summaryLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: theme.colors.onSurfaceVariant,
    marginBottom: 8,
  },
  summaryAmount: {
    fontFamily: theme.fonts.mono,
    fontSize: 24,
    color: theme.colors.onSurface,
  },
  summaryUnit: {
    fontSize: 14,
    color: theme.colors.primary,
  },
  listCard: {
    borderWidth: 1,
    borderColor: theme.colors.hardBorder,
    backgroundColor: theme.colors.panelBg,
    borderRadius: theme.radius.default,
    overflow: 'hidden',
  },
  listHeader: {
    padding: theme.spacing.gutter,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.hardBorder,
  },
  listTitle: {
    fontFamily: theme.fonts.mono,
    fontSize: 14,
    color: theme.colors.primary,
  },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.gutter,
  },
  listRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.hardBorder,
  },
  listName: {
    fontFamily: theme.fonts.mono,
    fontSize: 14,
    color: theme.colors.onSurface,
    marginBottom: 4,
  },
  listDate: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: theme.colors.tertiary,
  },
  listAmount: {
    fontFamily: theme.fonts.mono,
    fontSize: 14,
  },
  amountOut: {
    color: theme.colors.error,
  },
  amountIn: {
    color: theme.colors.tertiaryFixed,
  },
  fab: {
    position: 'absolute',
    right: theme.spacing.marginMobile,
    bottom: 88,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabIcon: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.onTertiary,
  },
});
