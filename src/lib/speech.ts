export interface RecordingController {
  stop: () => void;
}

type SpeechRecognitionCtor = new () => ISpeechRecognition;

interface ISpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
}

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as any;
  return (w.SpeechRecognition || w.webkitSpeechRecognition) ?? null;
}

export function isRecognitionSupported(): boolean {
  return getRecognitionCtor() !== null;
}

/**
 * Ensure the microphone permission is granted before starting recognition.
 * On mobile, calling getUserMedia first reliably triggers the OS permission prompt.
 * The stream is released immediately after permission is confirmed.
 */
async function ensureMicPermission(): Promise<void> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop());
  } catch (err: any) {
    if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
      throw new Error('not-allowed');
    }
    if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') {
      throw new Error('no-mic');
    }
    // Other errors — proceed anyway, recognition.start() may still work
  }
}

export async function startRecording(
  onInterim: (text: string) => void,
  onFinal: (text: string) => void,
  onError: (err: string) => void
): Promise<RecordingController> {
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    onError('当前浏览器不支持语音识别，建议使用 Android Chrome 或 Edge 浏览器打开。');
    return { stop: () => {} };
  }

  // Explicitly request mic permission first (mobile-friendly)
  try {
    await ensureMicPermission();
  } catch (err: any) {
    if (err.message === 'not-allowed') {
      onError('无法使用麦克风，请在手机设置中开启浏览器的麦克风权限。');
      return { stop: () => {} };
    }
    if (err.message === 'no-mic') {
      onError('未检测到麦克风设备，请检查设备连接。');
      return { stop: () => {} };
    }
    // non-fatal — continue
  }

  const recognition: ISpeechRecognition = new Ctor();
  recognition.lang = 'en-US';
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let stopped = false;
  let finalText = '';

  recognition.onresult = (event: any) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        finalText += result[0].transcript;
      } else {
        interim += result[0].transcript;
      }
    }
    onInterim(finalText + interim);
  };

  recognition.onerror = (event: any) => {
    if (stopped) return;
    const code = event.error || '';
    if (code === 'no-speech' || code === 'aborted') return;
    if (code === 'not-allowed' || code === 'service-not-allowed') {
      onError('无法使用麦克风，请在手机设置中开启浏览器的麦克风权限。');
      stopped = true;
      return;
    }
    if (code === 'audio-capture') {
      onError('未检测到麦克风设备，请检查设备连接。');
      stopped = true;
      return;
    }
    if (code === 'not-supported' || code === 'network') {
      onError('语音识别不可用，请检查网络连接或更换为 Chrome / Edge 浏览器。');
      stopped = true;
      return;
    }
    onError(`录音错误: ${code}`);
  };

  recognition.onend = () => {
    if (stopped) {
      onFinal(finalText.trim());
      return;
    }
    // Auto-restart for continuous dictation (unless intentionally stopped)
    try {
      recognition.start();
    } catch {
      onFinal(finalText.trim());
    }
  };

  try {
    recognition.start();
  } catch {
    onError('无法启动录音，请稍后重试。');
  }

  return {
    stop: () => {
      stopped = true;
      try {
        recognition.stop();
      } catch {
        onFinal(finalText.trim());
      }
    },
  };
}
