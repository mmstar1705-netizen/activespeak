import type { Settings } from '@/types';

export interface RecordingController {
  stop: () => void;
}

export function isRecognitionSupported(): boolean {
  return (
    typeof MediaRecorder !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

export async function transcribeAudio(blob: Blob, settings: Settings): Promise<string> {
  if (!settings.apiKey) {
    throw new Error('请先在 Settings 中配置 API Key 以启用语音转文字。');
  }

  const formData = new FormData();
  const ext = blob.type.includes('webm') ? 'recording.webm' : blob.type.includes('mp4') ? 'recording.mp4' : 'recording.audio';
  formData.append('file', blob, ext);
  formData.append('model', 'whisper-1');
  formData.append('language', 'en');
  formData.append('response_format', 'json');

  const res = await fetch(`${settings.baseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Whisper 转写失败 (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  return (data.text || '').trim();
}

export async function startRecording(
  onStatus: (status: 'recording' | 'transcribing', elapsedSec: number) => void,
  onFinal: (text: string) => void,
  onError: (err: string) => void,
  settings: Settings
): Promise<RecordingController> {
  let stream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let stopped = false;
  let timerId: ReturnType<typeof setInterval> | null = null;
  let elapsed = 0;

  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err: any) {
    if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
      onError('无法使用麦克风，请在手机设置中开启浏览器的麦克风权限。');
    } else if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') {
      onError('未检测到麦克风设备，请检查设备连接。');
    } else {
      onError('无法启动录音，请稍后重试。');
    }
    return { stop: () => {} };
  }

  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : '';

  try {
    recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);
  } catch {
    onError('当前浏览器不支持音频录制，请升级浏览器版本。');
    stream.getTracks().forEach(t => t.stop());
    return { stop: () => {} };
  }

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  recorder.onstop = async () => {
    if (timerId) clearInterval(timerId);
    stream?.getTracks().forEach(t => t.stop());

    if (stopped) {
      // aborted — don't transcribe
      return;
    }

    onStatus('transcribing', elapsed);

    const blob = new Blob(chunks, { type: mimeType || 'audio/webm' });

    try {
      const text = await transcribeAudio(blob, settings);
      onFinal(text);
    } catch (e: any) {
      onError(e.message || '语音转写失败，请检查 API Key 和网络连接。');
    } finally {
      // Release memory — zero storage footprint
      chunks = [];
    }
  };

  recorder.start(1000);
  onStatus('recording', 0);

  timerId = setInterval(() => {
    elapsed += 1;
    onStatus('recording', elapsed);
  }, 1000);

  return {
    stop: () => {
      stopped = false;
      if (timerId) clearInterval(timerId);
      if (recorder && recorder.state !== 'inactive') {
        recorder.stop();
      } else {
        stream?.getTracks().forEach(t => t.stop());
      }
    },
  };
}
