/**
 * TTS (Text-to-Speech) with async loading — does not block UI rendering.
 * Loads audio in the background; the UI renders text immediately.
 */

export function speak(text: string, lang: string = 'en-US'): void {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = lang
  utterance.rate = 0.9
  window.speechSynthesis.speak(utterance)
}

export function stopSpeaking(): void {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
}
