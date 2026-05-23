const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://134.209.216.232:8000/api/v1';

type RecognizeResponse =
  | {
      matched: true;
      confidence: number;
      requires_confirmation?: boolean;
      contact: {
        id: string;
        name: string;
        phone: string | null;
        solana_wallet_address: string | null;
        last_payment: { amount_usd: number; paid_at: string } | null;
        pending_debts: { debt_id: string; amount_usd: number; due_date: string }[];
        total_outstanding_usd: number;
      };
    }
  | { matched: false; confidence: number };

type ParseVoiceResponse =
  | { intent: 'pay'; amount_usd: number; confidence: number; raw_transcript: string }
  | { intent: 'unclear'; confidence: number; fallback: 'keypad' };

type ProcessVoiceResponse =
  | {
      intent: 'pay';
      amount_usd: number;
      confidence: number;
      raw_transcript: string;
      contact_id?: string;
    }
  | {
      intent: 'unclear';
      confidence: number;
      raw_transcript: string;
      fallback: 'keypad';
      reason?: string;
      contact_id?: string;
    };

type ExecutePaymentResponse =
  | {
      status: 'paid';
      transaction_signature: string;
      amount_sol: number;
      sol_price: number;
      confirmed_at: string;
      elevenlabs_line: string;
      debt_id: string;
    }
  | {
      status: 'pending';
      reason: string;
      wallet_balance_sol: number;
      required_sol: number;
      calendar_event_created: boolean;
      due_date: string;
      elevenlabs_line: string;
      debt_id: string;
    };

type CreateContactResponse = {
  contact_id: string;
  name: string;
  embeddings_stored: number;
  created_at: string;
};

type SolPriceResponse = {
  sol_usd: number;
  fetched_at: string;
  source: string;
};

type HealthResponse = {
  status: string;
  model_loaded: boolean;
  memory_percent?: number;
};

export type HistoryTransaction = {
  signature: string;
  slot: number;
  block_time: number; // unix seconds
  direction: 'sent' | 'received';
  counterparty_wallet: string;
  counterparty_name: string | null;
  amount_sol: number;
  cluster: string;
  explorer_url: string;
  notes: string | null;
};

export type TransactionHistoryResponse = {
  wallet: string;
  count: number;
  synced: number;
  transactions: HistoryTransaction[];
};

export type DebtRecord = {
  debt_id: string;
  from_user_id: string;
  to_wallet: string;
  to_contact_id: string;
  counterparty_name: string;
  amount_usd: number;
  status: 'pending' | 'scheduled' | 'paid' | 'failed';
  created_at: string;
  due_date: string | null;
  paid_at: string | null;
  transaction_signature: string | null;
};

export type UserDebtsResponse = {
  user_id: string;
  owed_by_me: DebtRecord[];
  owed_to_me: DebtRecord[];
  total_i_owe_usd: number;
  total_owed_to_me_usd: number;
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json();
}

export const api = {
  health: () => request<HealthResponse>('/health'),

  recognize: (imageBase64: string, userId: string) =>
    request<RecognizeResponse>('/recognize', {
      method: 'POST',
      body: JSON.stringify({ image_base64: imageBase64, user_id: userId }),
    }),

  parseVoice: (transcript: string, contactId: string) =>
    request<ParseVoiceResponse>('/voice/parse', {
      method: 'POST',
      body: JSON.stringify({ transcript, contact_id: contactId }),
    }),

  processVoice: async (audioUri: string, contactId?: string): Promise<ProcessVoiceResponse> => {
    const form = new FormData();
    // expo-av returns a file:// URI. RN FormData accepts {uri, name, type} as a file.
    const filename = audioUri.split('/').pop() || 'audio.m4a';
    const ext = filename.split('.').pop()?.toLowerCase();
    const type =
      ext === 'wav'
        ? 'audio/wav'
        : ext === 'mp3'
          ? 'audio/mpeg'
          : ext === 'caf'
            ? 'audio/x-caf'
            : 'audio/m4a';
    form.append('audio', { uri: audioUri, name: filename, type } as any);
    if (contactId) form.append('contact_id', contactId);

    const res = await fetch(`${API_BASE}/voice/process`, {
      method: 'POST',
      body: form as any,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`processVoice ${res.status}: ${body}`);
    }
    return res.json();
  },

  executePayment: (params: {
    userId: string;
    contactId: string;
    amountUsd: number;
    fromWallet: string;
    toWallet: string;
  }) =>
    request<ExecutePaymentResponse>('/payments/execute', {
      method: 'POST',
      body: JSON.stringify({
        user_id: params.userId,
        contact_id: params.contactId,
        amount_usd: params.amountUsd,
        from_wallet: params.fromWallet,
        to_wallet: params.toWallet,
      }),
    }),

  createContact: (params: {
    ownerUserId: string;
    name: string;
    phone: string | null;
    solanaWalletAddress: string | null;
    faceImagesBase64: string[];
  }) =>
    request<CreateContactResponse>('/contacts', {
      method: 'POST',
      body: JSON.stringify({
        owner_user_id: params.ownerUserId,
        name: params.name,
        phone: params.phone,
        solana_wallet_address: params.solanaWalletAddress,
        face_images_base64: params.faceImagesBase64,
      }),
    }),

  getContactDebts: (contactId: string) =>
    request<{
      contact_id: string;
      pending_debts: any[];
      paid_debts: any[];
      total_outstanding_usd: number;
      total_paid_usd: number;
    }>(`/contacts/${contactId}/debts`),

  getSolPrice: () => request<SolPriceResponse>('/sol/price'),

  getTransactionHistory: (wallet: string, limit = 30, sync = true) =>
    request<TransactionHistoryResponse>(
      `/transactions/${encodeURIComponent(wallet)}?limit=${limit}&sync=${sync ? 'true' : 'false'}`,
    ),

  createDebt: (params: {
    fromUserId: string;
    toContactId: string;
    toWallet: string;
    contactName: string;
    amountUsd: number;
    dueDate?: string | null;
  }) =>
    request<DebtRecord>('/debts', {
      method: 'POST',
      body: JSON.stringify({
        from_user_id: params.fromUserId,
        to_contact_id: params.toContactId,
        to_wallet: params.toWallet,
        contact_name: params.contactName,
        amount_usd: params.amountUsd,
        due_date: params.dueDate ?? null,
      }),
    }),

  getUserDebts: (wallet: string) =>
    request<UserDebtsResponse>(`/debts/by-user/${encodeURIComponent(wallet)}`),

  markDebtPaid: (debtId: string, transactionSignature?: string) =>
    request<DebtRecord>(
      `/debts/${encodeURIComponent(debtId)}/mark-paid${transactionSignature ? `?transaction_signature=${encodeURIComponent(transactionSignature)}` : ''}`,
      { method: 'POST' },
    ),
};
