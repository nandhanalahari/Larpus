import { Tabs } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { theme } from '@/constants/theme';

export const unstable_settings = {
  initialRouteName: 'profile',
};

const TAB_META: Record<
  string,
  { icon: keyof typeof MaterialIcons.glyphMap; label: string }
> = {
  profile:  { icon: 'person-outline',      label: 'Profile'  },
  index:    { icon: 'center-focus-strong', label: 'Scan'     },
  queue:    { icon: 'view-list',           label: 'Queue'    },
  history:  { icon: 'history',             label: 'History'  },
};

// Custom tab bar so we have direct access to `state.index` for the
// selected route. The default `tabBarButton` slot was not flipping
// the focused style reliably here.
function KolanaTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  return (
    <View style={styles.tabBarOuter} pointerEvents="box-none">
      <View style={styles.tabBar}>
        <BlurView
          intensity={Platform.OS === 'ios' ? 40 : 28}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: 'rgba(8,12,22,0.72)' },
          ]}
        />

        {state.routes.map((route, idx) => {
          const meta = TAB_META[route.name];
          if (!meta) return null;
          const focused = state.index === idx;
          const { options } = descriptors[route.key];

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name as never);
            }
          };
          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? meta.label}
              testID={(options as any).tabBarTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              style={[styles.item, focused && styles.itemActive]}
            >
              <MaterialIcons
                name={meta.icon}
                size={18}
                color={focused ? theme.colors.onAccent : theme.colors.textDim}
              />
              {focused ? (
                <Text style={styles.itemLabel} numberOfLines={1}>
                  {meta.label}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      initialRouteName="profile"
      tabBar={(props) => <KolanaTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.colors.bg },
      }}
    >
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="index" />
      <Tabs.Screen name="queue" />
      <Tabs.Screen name="history" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarOuter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingLeft: 14,
    paddingRight: 14,
    paddingBottom: Platform.OS === 'ios' ? 24 : 14,
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 64,
    paddingHorizontal: 8,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.borderHard,
    overflow: 'hidden',
    elevation: 16,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 20,
  },
  item: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 2,
    paddingHorizontal: 10,
    borderRadius: 18,
  },
  itemActive: {
    flex: 2,                  // give the pill more room so the label fits
    backgroundColor: theme.colors.accent,
  },
  itemLabel: {
    fontFamily: theme.fonts.monoSemibold,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: theme.colors.onAccent,
    includeFontPadding: false,
  },
});
