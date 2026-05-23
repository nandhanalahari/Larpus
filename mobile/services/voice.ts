import { Audio } from 'expo-av';
import { MIC_TIMEOUT_MS } from '@/constants/timing';

let recording: Audio.Recording | null = null;

export const voiceService = {
  requestPermission: async (): Promise<boolean> => {
    const { granted } = await Audio.requestPermissionsAsync();
    return granted;
  },

  startRecording: async (): Promise<boolean> => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recording = rec;
      return true;
    } catch (err) {
      console.warn('[Voice] start failed:', err);
      return false;
    }
  },

  stopRecording: async (): Promise<string | null> => {
    if (!recording) return null;

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      recording = null;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      return uri;
    } catch (err) {
      console.warn('[Voice] stop failed:', err);
      recording = null;
      return null;
    }
  },

  getRecordingUri: (): string | null => {
    return recording?.getURI() ?? null;
  },

  isRecording: (): boolean => {
    return recording !== null;
  },
};
