import type { Settings, Feedback, Word, CachedScenario } from '@/types';

async function callLLM(
  settings: Settings,
  messages: Array<{ role: string; content: string }>,
  onChunk?: (chunk: string) => void
): Promise<string> {
  if (!settings.apiKey) {
    throw new Error('Please set your API key in Settings first.');
  }

  const res = await fetch(`${settings.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      messages,
      temperature: 0.7,
      stream: !!onChunk,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API error ${res.status}: ${errText}`);
  }

  if (!onChunk) {
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response stream');

  const decoder = new TextDecoder();
  let full = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          full += delta;
          onChunk(delta);
        }
      } catch {
        // skip
      }
    }
  }

  return full;
}

export async function generateScenario(
  settings: Settings,
  words: Word[]
): Promise<{ scenario: string; semanticGroups: string[][] }> {
  const wordList = words.map(w => `${w.word} (${w.meaning})`).join(', ');

  const systemPrompt = `You are an English speaking practice assistant. Create a realistic daily-life scenario that naturally incorporates the given English vocabulary words.

Return JSON ONLY (no markdown, no code fences):
{
  "scenario": "A short Chinese scenario description (2-4 sentences) setting up a situation the user should describe in English. Include which words to use.",
  "semanticGroups": [["word1","word2"], ["word3"]]
}

Rules:
- Group words that belong to the same semantic network into the same scenario. If words span very different domains, split them into separate groups in semanticGroups.
- Each group in semanticGroups should have its own coherent scenario. But since we can only show one scenario at a time, pick the largest group and write its scenario. List all groups in semanticGroups.
- The scenario should be in Chinese, natural and engaging.
- Do NOT include the English words directly in the scenario text; describe the situation in Chinese and mention "请尝试用英语描述这个场景" implicitly.`;

  const userPrompt = `Words: ${wordList}

Create a scenario. Return JSON only.`;

  const raw = await callLLM(settings, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]);

  try {
    const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      scenario: parsed.scenario || '',
      semanticGroups: parsed.semanticGroups || [words.map(w => w.word)],
    };
  } catch {
    return {
      scenario: raw,
      semanticGroups: [words.map(w => w.word)],
    };
  }
}

export async function gradeSpeechStream(
  settings: Settings,
  scenario: string,
  userSpeech: string,
  targetWords: Word[],
  onChunk: (chunk: string) => void
): Promise<Feedback> {
  const wordInfo = targetWords
    .map(w => `${w.word} = ${w.meaning} (${w.proficiency})`)
    .join('\n');

  const systemPrompt = `You are an English speaking coach. Grade the user's spoken English response.

Return JSON ONLY (no markdown, no code fences):
{
  "score": 0-100,
  "grammarCorrections": ["correction1", "correction2"],
  "nativePolish": "A natural native-speaker version of what the user tried to say",
  "suggestions": ["tip1", "tip2"]
}

Rules:
- Score based on fluency, grammar, vocabulary usage, and relevance to the scenario.
- grammarCorrections: list specific grammar fixes (if any). Empty array if perfect.
- nativePolish: rephrase the user's intent into natural, idiomatic English.
- suggestions: For any target words (especially "mastered" level) that the user could have used but didn't, gently suggest: "此处可用 [word] 替换" in Chinese. Also include any usage tips.`;

  const userPrompt = `Scenario: ${scenario}

Target words:
${wordInfo}

User's speech: "${userSpeech}"

Grade this. Return JSON only.`;

  const raw = await callLLM(
    settings,
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    onChunk
  );

  try {
    const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      score: parsed.score ?? 0,
      grammarCorrections: parsed.grammarCorrections ?? [],
      nativePolish: parsed.nativePolish ?? '',
      suggestions: parsed.suggestions ?? [],
      raw,
    };
  } catch {
    return {
      score: 0,
      grammarCorrections: [],
      nativePolish: '',
      suggestions: [],
      raw,
    };
  }
}
