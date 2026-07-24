import type { Settings } from '@/types';

export function isSpeechSupported(): boolean {
  return 'speechSynthesis' in window;
}

const HIGH_QUALITY_KEYWORDS = ['natural', 'neural', 'google us english', 'online', 'premium', 'enhanced'];

function pickBestVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;

  const langLower = lang.toLowerCase();
  const langPrefix = langLower.split('-')[0];

  // 1. Match high-quality voices for the target language
  const highQuality = voices.find(v => {
    const vLang = v.lang.toLowerCase();
    const vName = v.name.toLowerCase();
    return (vLang === langLower || vLang.startsWith(langPrefix)) &&
           HIGH_QUALITY_KEYWORDS.some(kw => vName.includes(kw));
  });
  if (highQuality) return highQuality;

  // 2. Google US English specifically (best on Chrome)
  const googleUs = voices.find(v =>
    v.name.toLowerCase().includes('google us english') && v.lang.toLowerCase().startsWith('en')
  );
  if (googleUs) return googleUs;

  // 3. Any online/network voice for the language (not local service)
  const onlineVoice = voices.find(v => {
    const vLang = v.lang.toLowerCase();
    return (vLang === langLower || vLang.startsWith(langPrefix)) &&
           v.localService === false;
  });
  if (onlineVoice) return onlineVoice;

  // 4. Fallback to any voice matching the language
  const langMatch = voices.find(v => v.lang.toLowerCase().startsWith(langPrefix));
  if (langMatch) return langMatch;

  // 5. Last resort — first available voice
  return voices[0] ?? null;
}

export function speak(text: string, voice: string = 'en-US', rate: number = 1): void {
  if (!('speechSynthesis' in window)) {
    console.warn('Speech synthesis not supported');
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = voice;
  utterance.rate = rate;
  utterance.pitch = 1;
  utterance.volume = 1;

  const voices = window.speechSynthesis.getVoices();
  const best = pickBestVoice(voices, voice);
  if (best) utterance.voice = best;

  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

let currentAudio: HTMLAudioElement | null = null;

export async function speakWithCloudTTS(
  text: string,
  settings: Settings
): Promise<boolean> {
  if (!settings.apiKey) return false;

  stopCloudTTS();

  const voice = settings.ttsCloudVoice || 'nova';

  try {
    const res = await fetch(`${settings.baseUrl}/audio/speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: 'tts-1',
        voice,
        input: text,
        speed: settings.ttsRate || 1,
        response_format: 'mp3',
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn('Cloud TTS failed:', res.status, errText.slice(0, 200));
      return false;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudio = audio;

    audio.onended = () => {
      URL.revokeObjectURL(url);
      currentAudio = null;
    };

    audio.onerror = () => {
      URL.revokeObjectURL(url);
      currentAudio = null;
    };

    await audio.play();
    return true;
  } catch (e) {
    console.warn('Cloud TTS error:', e);
    return false;
  }
}

export function stopCloudTTS(): void {
  if (currentAudio) {
    currentAudio.pause();
    if (currentAudio.src) URL.revokeObjectURL(currentAudio.src);
    currentAudio = null;
  }
}
