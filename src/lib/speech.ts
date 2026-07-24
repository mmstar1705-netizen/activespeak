/**
 * Speech recognition wrapper with mobile compatibility.
 * - Requests microphone permission via getUserMedia before starting
 * - Supports both SpeechRecognition and webkitSpeechRecognition
 * - Continuous recognition with incremental text concatenation
 * - Manual stop only (no auto-stop on silence)
 */

type SpeechRecognitionType = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: any) => void) | null
  onerror: ((event: any) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

function getRecognitionClass(): { new (): SpeechRecognitionType } | null {
  const w = window as any
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

export function isSpeechRecognitionSupported(): boolean {
  return getRecognitionClass() !== null
}

export class SpeechController {
  private recognition: SpeechRecognitionType | null = null
  private stream: MediaStream | null = null
  private accumulated: string = ''
  private onText: ((text: string, isFinal: boolean) => void) | null = null
  private onEnd: (() => void) | null = null
  private manuallyStopped = false
  private running = false

  setCallbacks(onText: (text: string, isFinal: boolean) => void, onEnd: () => void) {
    this.onText = onText
    this.onEnd = onEnd
  }

  isRunning(): boolean {
    return this.running
  }

  async start(lang: string = 'en-US'): Promise<void> {
    const RecognitionClass = getRecognitionClass()
    if (!RecognitionClass) {
      throw new Error('UNSUPPORTED')
    }

    // Explicitly request microphone permission (mobile compatibility)
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        throw new Error('NOT_ALLOWED')
      }
      throw new Error('MIC_ERROR')
    }

    this.recognition = new RecognitionClass()
    this.recognition.continuous = true
    this.recognition.interimResults = true
    this.recognition.lang = lang
    this.accumulated = ''
    this.manuallyStopped = false
    this.running = true

    this.recognition.onresult = (event: any) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          this.accumulated += transcript
        } else {
          interim += transcript
        }
      }
      const display = this.accumulated + interim
      this.onText?.(display.trim(), false)
    }

    this.recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        this.running = false
        this.onEnd?.()
      }
    }

    this.recognition.onend = () => {
      // Auto-restart if not manually stopped (mobile browsers stop on silence)
      if (!this.manuallyStopped && this.running) {
        try {
          this.recognition?.start()
        } catch {
          this.running = false
          this.onEnd?.()
        }
      } else {
        this.running = false
        this.onEnd?.()
      }
    }

    this.recognition.start()
  }

  stop(): void {
    this.manuallyStopped = true
    this.running = false
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop())
      this.stream = null
    }
    if (this.recognition) {
      try {
        this.recognition.stop()
      } catch {
        // already stopped
      }
    }
  }

  getText(): string {
    return this.accumulated.trim()
  }
}
