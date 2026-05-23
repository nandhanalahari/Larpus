import 'react-native-get-random-values';
import { Buffer } from 'buffer';
(globalThis as any).Buffer = (globalThis as any).Buffer || Buffer;

import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import * as SecureStore from 'expo-secure-store';
import { FEE_BUFFER_SOL } from '@/constants/thresholds';
import { TX_CONFIRMATION_TIMEOUT_MS } from '@/constants/timing';

const RPC_URL = process.env.EXPO_PUBLIC_SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';
const connection = new Connection(RPC_URL, 'confirmed');

const WALLET_KEY = 'cipher_wallet_secret';

export const solanaService = {
  createWallet: async (): Promise<{ publicKey: string; created: boolean }> => {
    const existing = await SecureStore.getItemAsync(WALLET_KEY);
    if (existing) {
      const keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(existing)));
      return { publicKey: keypair.publicKey.toBase58(), created: false };
    }
    const keypair = Keypair.generate();
    await SecureStore.setItemAsync(WALLET_KEY, JSON.stringify(Array.from(keypair.secretKey)));
    return { publicKey: keypair.publicKey.toBase58(), created: true };
  },

  importWallet: async (secretKeyArray: number[]): Promise<string> => {
    const keypair = Keypair.fromSecretKey(Uint8Array.from(secretKeyArray));
    await SecureStore.setItemAsync(WALLET_KEY, JSON.stringify(secretKeyArray));
    return keypair.publicKey.toBase58();
  },

  getKeypair: async (): Promise<Keypair | null> => {
    const stored = await SecureStore.getItemAsync(WALLET_KEY);
    if (!stored) return null;
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(stored)));
  },

  getBalance: async (publicKey: string): Promise<number> => {
    const balance = await connection.getBalance(new PublicKey(publicKey));
    return balance / LAMPORTS_PER_SOL;
  },

  validateAddress: (address: string): boolean => {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  },

  sendPayment: async (
    toAddress: string,
    amountSol: number,
  ): Promise<{ signature: string; confirmed: boolean }> => {
    const keypair = await solanaService.getKeypair();
    if (!keypair) throw new Error('No wallet found');

    const toKey = new PublicKey(toAddress);
    const lamports = Math.round(amountSol * LAMPORTS_PER_SOL);

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey: toKey,
        lamports,
      }),
    );

    const signature = await sendAndConfirmTransaction(connection, tx, [keypair], {
      commitment: 'confirmed',
    });

    return { signature, confirmed: true };
  },

  canAfford: async (publicKey: string, amountSol: number): Promise<boolean> => {
    const balance = await solanaService.getBalance(publicKey);
    return balance >= amountSol + FEE_BUFFER_SOL;
  },

  shortenAddress: (address: string): string => {
    if (address.length <= 10) return address;
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  },

  requestAirdrop: async (publicKey: string, amountSol = 2): Promise<string> => {
    const sig = await connection.requestAirdrop(
      new PublicKey(publicKey),
      amountSol * LAMPORTS_PER_SOL,
    );
    await connection.confirmTransaction(sig, 'confirmed');
    return sig;
  },
};
