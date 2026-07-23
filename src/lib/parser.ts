import type { Word } from '@/types';
import { createSM2State } from './sm2';

export function parseWordlist(text: string): Word[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const words: Word[] = [];

  for (const line of lines) {
    const separators = ['\t', ' - ', ' — ', ' – ', '  ', '|', ','];
    let word = '';
    let meaning = '';

    for (const sep of separators) {
      const idx = line.indexOf(sep);
      if (idx > 0) {
        word = line.slice(0, idx).trim();
        meaning = line.slice(idx + sep.length).trim();
        break;
      }
    }

    if (!word) {
      const parts = line.split(/\s+/);
      if (parts.length >= 2) {
        word = parts[0];
        meaning = parts.slice(1).join(' ');
      } else {
        word = line;
        meaning = '';
      }
    }

    words.push({
      id: crypto.randomUUID(),
      word: word,
      meaning: meaning,
      proficiency: 'new',
      sm2: createSM2State(),
      paused: false,
      successCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  return words;
}
