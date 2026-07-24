import type { Scene, ScoreResult } from '@/types'

/**
 * Scene generation and scoring.
 * In a production app, these would call an LLM via an edge function.
 * Here we use a local generator that creates contextual scenes from word lists.
 */

export function generateScene(words: string[]): Scene {
  const templates = [
    `You're at a coffee shop ordering your morning drink. Use these words naturally: ${words.join(', ')}.`,
    `You're in a job interview discussing your experience. Try to use: ${words.join(', ')}.`,
    `You're catching up with an old friend at a park. Weave in: ${words.join(', ')}.`,
    `You're at a restaurant asking the waiter about the menu. Include: ${words.join(', ')}.`,
    `You're giving directions to a tourist on the street. Use: ${words.join(', ')}.`,
    `You're at a bookstore asking the staff for recommendations. Include: ${words.join(', ')}.`,
    `You're calling a hotel to book a room. Use: ${words.join(', ')}.`,
    `You're at the airport dealing with a delayed flight. Use: ${words.join(', ')}.`,
  ]
  const prompt = templates[Math.floor(Math.random() * templates.length)]
  return {
    id: crypto.randomUUID(),
    words,
    prompt,
    nativeText: '',
  }
}

export async function generateSceneAsync(words: string[]): Promise<Scene> {
  // Simulate async generation latency for pre-generation
  return new Promise((resolve) => {
    setTimeout(() => resolve(generateScene(words)), 50)
  })
}

export function scoreResponse(
  userText: string,
  scene: Scene,
  words: { word: string; meaning: string }[],
): ScoreResult {
  const lower = userText.toLowerCase()
  const usedWords = words.filter((w) => lower.includes(w.word.toLowerCase()))
  const wordScore = words.length > 0 ? (usedWords.length / words.length) * 100 : 0
  const lengthScore = Math.min(userText.split(/\s+/).length / 10, 1) * 100
  const score = Math.round(wordScore * 0.6 + lengthScore * 0.4)

  const missing = words.filter((w) => !lower.includes(w.word.toLowerCase())).map((w) => w.word)
  const corrections: string[] = []

  if (missing.length > 0) {
    corrections.push(`Try to include these words: ${missing.join(', ')}`)
  }
  if (userText.length < 20) {
    corrections.push('Try to speak in fuller sentences.')
  }

  const feedbackParts: string[] = []
  if (usedWords.length > 0) {
    feedbackParts.push(`Great job using ${usedWords.length}/${words.length} target words.`)
  }
  if (score >= 80) {
    feedbackParts.push('Excellent fluency and natural expression!')
  } else if (score >= 50) {
    feedbackParts.push('Good attempt — keep practicing to build confidence.')
  } else {
    feedbackParts.push('Keep going — practice makes perfect!')
  }
  if (corrections.length > 0) {
    feedbackParts.push('Suggestions: ' + corrections.join(' '))
  }

  return {
    score,
    feedback: feedbackParts.join(' '),
    corrections,
  }
}

export async function* streamScore(
  userText: string,
  scene: Scene,
  words: { word: string; meaning: string }[],
): AsyncGenerator<string> {
  const result = scoreResponse(userText, scene, words)
  const tokens = result.feedback.split(/(\s+)/)
  for (const token of tokens) {
    await new Promise((r) => setTimeout(r, 30))
    yield token
  }
}
