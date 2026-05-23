from pydantic import BaseModel
from datetime import datetime


# ── /recognize ──

class RecognizeRequest(BaseModel):
    image_base64: str
    user_id: str


class LastPayment(BaseModel):
    amount_usd: float
    paid_at: str


class PendingDebt(BaseModel):
    debt_id: str
    amount_usd: float
    due_date: str


class ContactInfo(BaseModel):
    id: str
    name: str
    phone: str | None = None
    solana_wallet_address: str | None = None
    last_payment: LastPayment | None = None
    pending_debts: list[PendingDebt] = []
    total_outstanding_usd: float = 0.0


class RecognizeMatchResponse(BaseModel):
    matched: bool = True
    confidence: float
    requires_confirmation: bool = False
    contact: ContactInfo


class RecognizeNoMatchResponse(BaseModel):
    matched: bool = False
    confidence: float


# ── /voice/parse ──

class VoiceParseRequest(BaseModel):
    transcript: str
    contact_id: str


class VoiceParsePayResponse(BaseModel):
    intent: str = "pay"
    amount_usd: float
    confidence: float
    raw_transcript: str


class VoiceParseUnclearResponse(BaseModel):
    intent: str = "unclear"
    confidence: float = 0.0
    fallback: str = "keypad"


# ── /contacts ──

class CreateContactRequest(BaseModel):
    owner_user_id: str
    name: str
    phone: str | None = None
    solana_wallet_address: str | None = None
    face_images_base64: list[str]


class CreateContactResponse(BaseModel):
    contact_id: str
    name: str
    embeddings_stored: int
    created_at: str


# ── /payments/execute ──

class ExecutePaymentRequest(BaseModel):
    user_id: str
    contact_id: str
    amount_usd: float
    from_wallet: str
    to_wallet: str


class PaymentPaidResponse(BaseModel):
    status: str = "paid"
    transaction_signature: str
    amount_sol: float
    sol_price: float
    confirmed_at: str
    elevenlabs_line: str = "paid_confirmation"
    debt_id: str


class PaymentPendingResponse(BaseModel):
    status: str = "pending"
    reason: str
    wallet_balance_sol: float
    required_sol: float
    calendar_event_created: bool = False
    due_date: str
    elevenlabs_line: str = "insufficient_funds"
    debt_id: str


# ── /sol/price ──

class SolPriceResponse(BaseModel):
    sol_usd: float
    fetched_at: str
    source: str = "coingecko"


# ── /transactions/{wallet} ──

class HistoryTransaction(BaseModel):
    signature: str
    slot: int
    block_time: int  # unix seconds
    direction: str  # "sent" | "received"
    counterparty_wallet: str
    counterparty_name: str | None = None
    amount_sol: float
    cluster: str
    explorer_url: str
    notes: str | None = None  # optional free-text purpose / memo


class TransactionHistoryResponse(BaseModel):
    wallet: str
    count: int
    synced: int
    transactions: list[HistoryTransaction]


# ── /debts ──

class CreateDebtRequest(BaseModel):
    from_user_id: str          # debtor wallet (the one who owes)
    to_contact_id: str         # contact-doc _id (creditor as a contact in debtor's list)
    to_wallet: str             # creditor wallet — needed for symmetric "owed to me" lookup
    contact_name: str          # snapshot of creditor name at time of creation
    amount_usd: float
    due_date: str | None = None  # ISO yyyy-mm-dd; null = no scheduled date


class DebtRecord(BaseModel):
    debt_id: str
    from_user_id: str
    to_wallet: str
    to_contact_id: str
    counterparty_name: str
    amount_usd: float
    status: str  # pending | paid | failed | scheduled
    created_at: str
    due_date: str | None = None
    paid_at: str | None = None
    transaction_signature: str | None = None


class UserDebtsResponse(BaseModel):
    user_id: str
    owed_by_me: list[DebtRecord]   # I am from_user_id
    owed_to_me: list[DebtRecord]   # I am to_wallet
    total_i_owe_usd: float
    total_owed_to_me_usd: float


# ── Health ──

class HealthResponse(BaseModel):
    model_config = {"protected_namespaces": ()}

    status: str = "ok"
    model_loaded: bool = False
    memory_percent: float | None = None
