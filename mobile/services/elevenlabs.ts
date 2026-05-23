import { Audio } from 'expo-av';

const API_KEY = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY ?? '';
const VOICE_ID = process.env.EXPO_PUBLIC_ELEVENLABS_VOICE_ID ?? '';
const BASE_URL = 'https://api.elevenlabs.io/v1';

type VoiceLine =
  | 'paid_confirmation'
  | 'deposit_received'
  | 'insufficient_funds'
  | 'payment_scheduled'
  | 'tx_failed'
  | 'queue_added'
  | 'queue_complete'
  | 'voice_unclear'
  | 'new_face'
  | 'low_confidence'
  | 'insufficient_queue'
  | 'welcome';

const lineTemplates: Record<VoiceLine, (...args: string[]) => string> = {
  paid_confirmation: (amount, name) => `Paid. ${amount} sent to ${name}. Confirmed on Solana.`,
  deposit_received: (amount, name) =>
    `Deposit received. ${amount} from ${name}. Confirmed on Solana.`,
  insufficient_funds: () => `Not enough funds. I've saved this and set a reminder for next week.`,
  payment_scheduled: (amount, name, date) =>
    `Got it. ${amount} to ${name} scheduled for ${date}. Added to your queue.`,
  tx_failed: () => `Transaction failed. Please try again.`,
  queue_added: (amount, name) => `${amount} added to queue for ${name}.`,
  queue_complete: (total, count) => `Done. ${total} sent to ${count} people.`,
  voice_unclear: () => `Didn't catch that. How much?`,
  new_face: () => `New face. Add this person to get started.`,
  low_confidence: (name) => `Is this ${name}?`,
  insufficient_queue: (...names) => {
    const last = names.pop();
    return `Not enough for everyone. ${names.join(' and ')} will go through. ${last} will be saved for later.`;
  },
  welcome: () => `Welcome to KOLANA. Let's set up your wallet.`,
};

let currentSound: Audio.Sound | null = null;

export const elevenlabsService = {
  getLineText: (line: VoiceLine, ...args: string[]): string => {
    return lineTemplates[line](...args);
  },

  speak: async (text: string): Promise<void> => {
    if (!API_KEY || !VOICE_ID) {
      console.warn('[ElevenLabs] No API key or voice ID configured');
      return;
    }

    try {
      if (currentSound) {
        await currentSound.unloadAsync();
        currentSound = null;
      }

      const res = await fetch(`${BASE_URL}/text-to-speech/${VOICE_ID}`, {
        method: 'POST',
        headers: {
          'xi-api-key': API_KEY,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.75,
          },
        }),
      });

      if (!res.ok) {
        console.warn(`[ElevenLabs] ${res.status}`);
        return;
      }

      const blob = await res.blob();
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });

      const { sound } = await Audio.Sound.createAsync({ uri: base64 });
      currentSound = sound;
      await sound.playAsync();
    } catch (err) {
      console.warn('[ElevenLabs] speak failed:', err);
    }
  },

  speakLine: async (line: VoiceLine, ...args: string[]): Promise<void> => {
    const text = lineTemplates[line](...args);
    return elevenlabsService.speak(text);
  },

  stop: async (): Promise<void> => {
    if (currentSound) {
      await currentSound.stopAsync();
      await currentSound.unloadAsync();
      currentSound = null;
    }
  },
};
