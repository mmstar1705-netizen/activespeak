/**
 * Parse various word import formats:
 * - One word per line
 * - word,meaning (CSV)
 * - word - meaning
 * - word: meaning
 * - word meaning (tab or multiple spaces)
 */

export interface ParsedWord {
  word: string
  meaning: string
}

export function parseWordList(input: string): ParsedWord[] {
  const lines = input.split('\n').map((l) => l.trim()).filter(Boolean)
  const results: ParsedWord[] = []

  for (const line of lines) {
    let word = ''
    let meaning = ''

    // Try " - " separator
    if (line.includes(' - ')) {
      const parts = line.split(' - ')
      word = parts[0].trim()
      meaning = parts.slice(1).join(' - ').trim()
    }
    // Try ":" separator
    else if (line.includes(':')) {
      const idx = line.indexOf(':')
      word = line.slice(0, idx).trim()
      meaning = line.slice(idx + 1).trim()
    }
    // Try "," separator (but not within the word itself)
    else if (line.includes(',')) {
      const parts = line.split(',')
      word = parts[0].trim()
      meaning = parts.slice(1).join(',').trim()
    }
    // Try tab separator
    else if (line.includes('\t')) {
      const parts = line.split('\t')
      word = parts[0].trim()
      meaning = parts.slice(1).join(' ').trim()
    }
    // Try multiple spaces
    else if (/\s{2,}/.test(line)) {
      const parts = line.split(/\s{2,}/)
      word = parts[0].trim()
      meaning = parts.slice(1).join(' ').trim()
    }
    // Just a word
    else {
      word = line
      meaning = ''
    }

    if (word) {
      results.push({ word, meaning })
    }
  }

  return results
}
