import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#000' },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="wallet" />
      <Stack.Screen name="enroll-self" />
      <Stack.Screen name="add-first" />
    </Stack>
  );
}
