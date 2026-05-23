import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  ONBOARDING: 'cipher_onboarding',
  CONTACTS: 'cipher_contacts_cache',
  QUEUE: 'cipher_queue_state',
  SOL_PRICE: 'cipher_sol_price',
} as const;

export const cacheService = {
  getOnboardingState: async () => {
    const raw = await AsyncStorage.getItem(KEYS.ONBOARDING);
    if (!raw) return { walletDone: false, selfEnrolled: false, firstContact: false };
    return JSON.parse(raw) as { walletDone: boolean; selfEnrolled: boolean; firstContact: boolean };
  },

  setOnboardingState: async (state: {
    walletDone: boolean;
    selfEnrolled: boolean;
    firstContact: boolean;
  }) => {
    await AsyncStorage.setItem(KEYS.ONBOARDING, JSON.stringify(state));
  },

  cacheContacts: async (contacts: any[]) => {
    await AsyncStorage.setItem(KEYS.CONTACTS, JSON.stringify(contacts));
  },

  getCachedContacts: async () => {
    const raw = await AsyncStorage.getItem(KEYS.CONTACTS);
    return raw ? JSON.parse(raw) : [];
  },

  saveQueueState: async (queue: any[]) => {
    await AsyncStorage.setItem(KEYS.QUEUE, JSON.stringify(queue));
  },

  getQueueState: async () => {
    const raw = await AsyncStorage.getItem(KEYS.QUEUE);
    return raw ? JSON.parse(raw) : [];
  },

  clearQueueState: async () => {
    await AsyncStorage.removeItem(KEYS.QUEUE);
  },

  cacheSolPrice: async (price: number) => {
    await AsyncStorage.setItem(
      KEYS.SOL_PRICE,
      JSON.stringify({ price, fetchedAt: Date.now() }),
    );
  },

  getCachedSolPrice: async () => {
    const raw = await AsyncStorage.getItem(KEYS.SOL_PRICE);
    if (!raw) return null;
    return JSON.parse(raw) as { price: number; fetchedAt: number };
  },

  clearAll: async () => {
    await AsyncStorage.multiRemove(Object.values(KEYS));
  },
};
