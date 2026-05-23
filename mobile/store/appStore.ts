import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Contact = {
  id: string;
  name: string;
  phone: string | null;
  solanaWalletAddress: string | null;
  lastPayment: { amountUsd: number; paidAt: string } | null;
  pendingDebts: { debtId: string; amountUsd: number; dueDate: string }[];
  totalOutstandingUsd: number;
};

export type QueueItem = {
  id: string;
  contact: Contact;
  amountUsd: number;
  status: 'waiting' | 'sending' | 'confirmed' | 'failed';
  txSignature?: string;
  error?: string;
};

export type Debt = {
  id: string;
  contactId: string;
  contactName: string;
  amountUsd: number;
  status: 'pending' | 'paid' | 'failed' | 'scheduled';
  createdAt: string;
  paidAt?: string;
  dueDate?: string;
};

export type Transaction = {
  id: string;
  debtId: string;
  contactName: string;
  amountUsd: number;
  amountSol: number;
  solPrice: number;
  signature: string;
  status: 'confirming' | 'confirmed' | 'failed';
  createdAt: string;
  confirmedAt?: string;
};

type AppState = {
  // Onboarding
  onboardingComplete: boolean;
  walletSetup: boolean;
  selfEnrolled: boolean;
  firstContactAdded: boolean;
  setOnboardingStep: (step: 'wallet' | 'self' | 'contact') => void;
  completeOnboarding: () => void;

  // User
  userName: string | null;
  walletAddress: string | null;
  walletBalanceSol: number;
  selfContactId: string | null;
  setUser: (name: string, wallet: string) => void;
  setSelfContactId: (id: string) => void;
  setWalletBalance: (balance: number) => void;

  // Recognized contact
  recognizedContact: Contact | null;
  recognitionConfidence: number;
  requiresConfirmation: boolean;
  setRecognizedContact: (contact: Contact | null, confidence: number, requiresConfirmation: boolean) => void;
  clearRecognizedContact: () => void;

  // Voice
  isListening: boolean;
  transcript: string;
  parsedAmount: number | null;
  parsedDueDate: string | null;
  setListening: (listening: boolean) => void;
  setTranscript: (text: string) => void;
  setParsedAmount: (amount: number | null) => void;
  setParsedDueDate: (dueDate: string | null) => void;

  // Queue
  queue: QueueItem[];
  addToQueue: (contact: Contact, amountUsd: number) => void;
  updateQueueItem: (id: string, update: Partial<QueueItem>) => void;
  clearQueue: () => void;
  removeFromQueue: (id: string) => void;

  // History
  transactions: Transaction[];
  debts: Debt[];
  addTransaction: (tx: Transaction) => void;
  addDebt: (debt: Debt) => void;
  updateDebt: (id: string, update: Partial<Debt>) => void;

  // Server
  serverReady: boolean;
  demoMode: boolean;
  setServerReady: (ready: boolean) => void;
  toggleDemoMode: () => void;

  // SOL price
  solPrice: number | null;
  solPriceFetchedAt: number | null;
  setSolPrice: (price: number) => void;
};

let queueIdCounter = 0;

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
  onboardingComplete: false,
  walletSetup: false,
  selfEnrolled: false,
  firstContactAdded: false,
  setOnboardingStep: (step) =>
    set((s) => {
      if (step === 'wallet') return { walletSetup: true };
      if (step === 'self') return { selfEnrolled: true };
      if (step === 'contact') return { firstContactAdded: true };
      return s;
    }),
  completeOnboarding: () => set({ onboardingComplete: true }),

  userName: null,
  walletAddress: null,
  walletBalanceSol: 0,
  selfContactId: null,
  setUser: (name, wallet) => set({ userName: name, walletAddress: wallet }),
  setSelfContactId: (id) => set({ selfContactId: id }),
  setWalletBalance: (balance) => set({ walletBalanceSol: balance }),

  recognizedContact: null,
  recognitionConfidence: 0,
  requiresConfirmation: false,
  setRecognizedContact: (contact, confidence, requiresConfirmation) =>
    set({ recognizedContact: contact, recognitionConfidence: confidence, requiresConfirmation }),
  clearRecognizedContact: () =>
    set({ recognizedContact: null, recognitionConfidence: 0, requiresConfirmation: false }),

  isListening: false,
  transcript: '',
  parsedAmount: null,
  parsedDueDate: null,
  setListening: (listening) => set({ isListening: listening }),
  setTranscript: (text) => set({ transcript: text }),
  setParsedAmount: (amount) => set({ parsedAmount: amount }),
  setParsedDueDate: (dueDate) => set({ parsedDueDate: dueDate }),

  queue: [],
  addToQueue: (contact, amountUsd) =>
    set((s) => ({
      queue: [
        ...s.queue,
        {
          id: `q-${++queueIdCounter}`,
          contact,
          amountUsd,
          status: 'waiting',
        },
      ],
    })),
  updateQueueItem: (id, update) =>
    set((s) => ({
      queue: s.queue.map((item) => (item.id === id ? { ...item, ...update } : item)),
    })),
  clearQueue: () => set({ queue: [] }),
  removeFromQueue: (id) =>
    set((s) => ({ queue: s.queue.filter((item) => item.id !== id) })),

  transactions: [],
  debts: [],
  addTransaction: (tx) => set((s) => ({ transactions: [tx, ...s.transactions] })),
  addDebt: (debt) => set((s) => ({ debts: [debt, ...s.debts] })),
  updateDebt: (id, update) =>
    set((s) => ({
      debts: s.debts.map((d) => (d.id === id ? { ...d, ...update } : d)),
    })),

  serverReady: false,
  demoMode: false,
  setServerReady: (ready) => set({ serverReady: ready }),
  toggleDemoMode: () => set((s) => ({ demoMode: !s.demoMode })),

  solPrice: null,
  solPriceFetchedAt: null,
  setSolPrice: (price) => set({ solPrice: price, solPriceFetchedAt: Date.now() }),
    }),
    {
      name: 'cipher_app_store',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist user-owned, durable slices. Skip ephemeral UI state
      // (recognizedContact, isListening, transcript) and server-side cached
      // truth (walletBalanceSol, solPrice) — those rehydrate from the live source.
      partialize: (state) => ({
        onboardingComplete: state.onboardingComplete,
        walletSetup: state.walletSetup,
        selfEnrolled: state.selfEnrolled,
        firstContactAdded: state.firstContactAdded,
        userName: state.userName,
        walletAddress: state.walletAddress,
        selfContactId: state.selfContactId,
        transactions: state.transactions,
        debts: state.debts,
        queue: state.queue,
        demoMode: state.demoMode,
      }),
    },
  ),
);
