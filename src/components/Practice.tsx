import { useState, useRef, useCallback, useEffect } from 'react';
import { useStore } from '@/store';
import { generateScenario, gradeSpeechStream } from '@/lib/llm';
import { startRecording, isRecognitionSupported } from '@/lib/speech';
import { isDueToday } from '@/lib/sm2';
import { speak, isSpeechSupported } from '@/lib/tts';
import type { Word, Feedback, CachedScenario } from '@/types';
import { Mic, MicOff, Volume2, Sparkles, ChevronRight, RefreshCw, CheckCircle2, AlertCircle, Zap } from 'lucide-react';
import { useToast } from '@/components/Toast';

type Phase = 'idle' | 'generating' | 'scenario' | 'recording' | 'grading' | 'feedback';

const SCENARIO_CACHE_KEY = 'currentUnansweredScenario';
const PREFETCH_CACHE_KEY = 'prefetchedScenario';

export default function Practice({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { groups, getGroupWords, settings, reviewWord, getDueWords, getActiveWords, words } = useStore();
  const { showToast } = useToast();
  const [phase, setPhase] = useState<Phase>('idle');
  const [scenario, setScenario] = useState('');
  const [activeWords, setActiveWords] = useState<Word[]>([]);
  const [semanticGroups, setSemanticGroups] = useState<string[][]>([]);
  const [transcript, setTranscript] = useState('');
  const [editedTranscript, setEditedTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [error, setError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [groupIndex, setGroupIndex] = useState(0);
  const [prefetching, setPrefetching] = useState(false);
  const recordingRef = useRef<{ stop: () => void } | null>(null);
  const prefetchRef = useRef(false);

  const speechSupported = isRecognitionSupported();
  const ttsSupported = isSpeechSupported();

  // Pick words respecting SRS settings, filtering paused words
  const pickWords = useCallback((): Word[] => {
    const active = getActiveWords();
    if (active.length === 0) return [];

    const due = active.filter(w => isDueToday(w.sm2));

    const wps = settings.srs.wordsPerScenario;

    if (due.length >= wps) {
      return [...due].sort(() => Math.random() - 0.5).slice(0, wps);
    }

    // Fill remaining with new words
    const newWords = active.filter(w => w.proficiency === 'new' && !due.includes(w));
    const combined = [...due, ...newWords.sort(() => Math.random() - 0.5)];
    if (combined.length >= wps) return combined.slice(0, wps);

    // Fill from any active words
    const remaining = active.filter(w => !combined.includes(w)).sort(() => Math.random() - 0.5);
    return [...combined, ...remaining].slice(0, Math.min(wps, active.length));
  }, [getActiveWords, settings.srs.wordsPerScenario]);

  // Save scenario to localStorage
  const saveScenario = useCallback((text: string, words: Word[], groups: string[][]) => {
    const cache: CachedScenario = {
      scenario: text,
      semanticGroups: groups,
      wordIds: words.map(w => w.id),
    };
    localStorage.setItem(SCENARIO_CACHE_KEY, JSON.stringify(cache));
  }, []);

  // Clear scenario from localStorage
  const clearScenarioCache = useCallback(() => {
    localStorage.removeItem(SCENARIO_CACHE_KEY);
  }, []);

  // Restore words from cached word IDs
  const restoreWords = useCallback((wordIds: string[]): Word[] => {
    return words.filter(w => wordIds.includes(w.id) && !w.paused);
  }, [words]);

  // Prefetch next scenario
  const prefetchNext = useCallback(async () => {
    if (prefetchRef.current || prefetching) return;
    if (!settings.apiKey) return;

    prefetchRef.current = true;
    setPrefetching(true);

    try {
      const picked = pickWords();
      if (picked.length === 0) return;

      const result = await generateScenario(settings, picked);
      const cache: CachedScenario = {
        scenario: result.scenario,
        semanticGroups: result.semanticGroups,
        wordIds: picked.map(w => w.id),
      };
      localStorage.setItem(PREFETCH_CACHE_KEY, JSON.stringify(cache));
    } catch (e) {
      // silent fail
    } finally {
      prefetchRef.current = false;
      setPrefetching(false);
    }
  }, [settings, pickWords, prefetching]);

  // Check for cached scenario on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem(SCENARIO_CACHE_KEY);
      if (cached) {
        const parsed: CachedScenario = JSON.parse(cached);
        const restored = restoreWords(parsed.wordIds);
        if (restored.length > 0 && parsed.scenario) {
          setScenario(parsed.scenario);
          setActiveWords(restored);
          setSemanticGroups(parsed.semanticGroups || []);
          setPhase('scenario');
          return;
        }
      }
    } catch (e) {
      // ignore
    }
    // No cache — start fresh
    handleStart();
  }, []);

  const handleStart = async () => {
    setError('');
    setFeedback(null);
    setTranscript('');
    setScenario('');

    if (!settings.apiKey) {
      setError('Please set your API key in Settings first.');
      return;
    }

    // Try prefetch cache first
    try {
      const prefetched = localStorage.getItem(PREFETCH_CACHE_KEY);
      if (prefetched) {
        const parsed: CachedScenario = JSON.parse(prefetched);
        const restored = restoreWords(parsed.wordIds);
        if (restored.length > 0 && parsed.scenario) {
          setScenario(parsed.scenario);
          setActiveWords(restored);
          setSemanticGroups(parsed.semanticGroups || []);
          setPhase('scenario');
          saveScenario(parsed.scenario, restored, parsed.semanticGroups || []);
          localStorage.removeItem(PREFETCH_CACHE_KEY);
          return;
        }
      }
    } catch (e) {
      // ignore
    }

    const picked = pickWords();
    if (picked.length === 0) {
      setError('No words available. Import a wordlist first.');
      return;
    }

    setActiveWords(picked);
    setPhase('generating');

    try {
      const result = await generateScenario(settings, picked);
      setScenario(result.scenario);
      setSemanticGroups(result.semanticGroups);
      setPhase('scenario');
      saveScenario(result.scenario, picked, result.semanticGroups);
    } catch (e: any) {
      setError(e.message || 'Failed to generate scenario.');
      setPhase('idle');
    }
  };

  const handleRecord = async () => {
    if (!speechSupported) {
      const msg = '当前浏览器不支持语音识别，建议使用 Android Chrome 或 Edge 浏览器打开。';
      setError(msg);
      showToast('error', msg);
      return;
    }

    setError('');
    setTranscript('');
    setEditedTranscript('');
    setInterimText('');
    setFeedback(null);
    setIsRecording(true);
    setPhase('recording');

    recordingRef.current = await startRecording(
      (text) => {
        setInterimText(text);
      },
      (finalText) => {
        setTranscript(finalText);
        setEditedTranscript(finalText);
        setInterimText('');
        setIsRecording(false);
        setPhase('scenario');
      },
      (err) => {
        setError(err);
        showToast('error', err);
        setIsRecording(false);
        setPhase('scenario');
      }
    );
  };

  const handleStopRecord = () => {
    recordingRef.current?.stop();
  };

  const handleGrade = async () => {
    const finalText = editedTranscript.trim();
    if (!finalText) {
      setError('Please speak something first.');
      return;
    }

    setError('');
    setPhase('grading');
    setStreamingText('');
    setFeedback(null);

    try {
      const result = await gradeSpeechStream(
        settings,
        scenario,
        finalText,
        activeWords,
        (chunk) => {
          setStreamingText(prev => prev + chunk);
        }
      );
      setFeedback(result);
      setPhase('feedback');

      // Apply SM-2 review
      const quality = result.score >= 80 ? 5 : result.score >= 60 ? 4 : result.score >= 40 ? 3 : result.score >= 20 ? 2 : 1;
      for (const w of activeWords) {
        reviewWord(w.id, quality, result.score);
      }

      // Clear the answered scenario
      clearScenarioCache();

      // Prefetch next scenario in background
      prefetchNext();
    } catch (e: any) {
      setError(e.message || 'Failed to grade speech.');
      setPhase('scenario');
    }
  };

  const handlePlayTTS = () => {
    if (feedback?.nativePolish) {
      speak(feedback.nativePolish, settings.ttsVoice, settings.ttsRate);
    }
  };

  const handleNext = () => {
    // Clear cache on skip
    clearScenarioCache();
    setPhase('idle');
    setScenario('');
    setFeedback(null);
    setTranscript('');
    setEditedTranscript('');
    setInterimText('');
    setActiveWords([]);
    setSemanticGroups([]);
    setStreamingText('');

    // Try prefetched scenario first
    try {
      const prefetched = localStorage.getItem(PREFETCH_CACHE_KEY);
      if (prefetched) {
        const parsed: CachedScenario = JSON.parse(prefetched);
        const restored = restoreWords(parsed.wordIds);
        if (restored.length > 0 && parsed.scenario) {
          setScenario(parsed.scenario);
          setActiveWords(restored);
          setSemanticGroups(parsed.semanticGroups || []);
          setPhase('scenario');
          saveScenario(parsed.scenario, restored, parsed.semanticGroups || []);
          localStorage.removeItem(PREFETCH_CACHE_KEY);
          // Kick off next prefetch
          setTimeout(() => prefetchNext(), 100);
          return;
        }
      }
    } catch (e) {
      // ignore
    }

    // No prefetch — generate new
    handleStart();
  };

  const getHint = (word: Word) => {
    if (word.paused) return { label: 'Paused', type: 'none' as const };
    switch (word.proficiency) {
      case 'new':
        return { label: word.word, type: 'word' as const };
      case 'familiar':
        return { label: word.meaning, type: 'meaning' as const };
      case 'mastered':
        return { label: 'No hint', type: 'none' as const };
    }
  };

  if (words.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-400 mb-4">No words imported yet.</p>
        <button
          onClick={() => onNavigate('import')}
          className="px-6 py-2.5 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors"
        >
          Import Wordlist
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Practice</h1>
        <div className="flex items-center gap-3">
          {prefetching && (
            <span className="flex items-center gap-1 text-xs text-blue-500">
              <Zap size={12} /> Preloading next
            </span>
          )}
          {phase !== 'idle' && phase !== 'generating' && (
            <button
              onClick={handleNext}
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-1"
            >
              Skip <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-4 mb-6 flex items-start gap-2">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Phase: idle */}
      {phase === 'idle' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Sparkles className="text-blue-500" size={28} />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Ready to Practice?</h2>
          <p className="text-gray-500 text-sm mb-6">
            We'll pick {settings.srs.wordsPerScenario} words from your vocabulary, generate a real-life scenario, and you'll describe it in English.
          </p>
          <button
            onClick={handleStart}
            className="px-8 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors"
          >
            Start Session
          </button>
        </div>
      )}

      {/* Phase: generating */}
      {phase === 'generating' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="inline-flex items-center gap-2 text-gray-500">
            <RefreshCw size={20} className="animate-spin" />
            <span>Generating scenario...</span>
          </div>
        </div>
      )}

      {/* Phase: scenario / recording / grading */}
      {(phase === 'scenario' || phase === 'recording' || phase === 'grading') && (
        <div className="space-y-5">
          {/* Scenario card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-medium px-2.5 py-1 bg-blue-50 text-blue-600 rounded-full">Scenario</span>
              {semanticGroups.length > 1 && (
                <span className="text-xs text-gray-400">{semanticGroups.length} semantic groups detected</span>
              )}
            </div>
            <p className="text-gray-800 leading-relaxed">{scenario}</p>
          </div>

          {/* Hints */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-sm font-semibold text-gray-500 mb-3">Target Words</h3>
            <div className="space-y-2">
              {activeWords.map(word => {
                const hint = getHint(word);
                return (
                  <div key={word.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        word.proficiency === 'new' ? 'bg-amber-100 text-amber-700' :
                        word.proficiency === 'familiar' ? 'bg-teal-100 text-teal-700' :
                        'bg-emerald-100 text-emerald-700'
                      }`}>
                        {word.proficiency}
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {hint.type === 'word' && hint.label}
                        {hint.type === 'meaning' && `Hint: ${hint.label}`}
                        {hint.type === 'none' && 'No hint — use it from memory!'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recording controls */}
          {phase === 'scenario' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <p className="text-sm text-gray-500 mb-4 text-center">
                Describe the scenario in English using the target words.
              </p>
              {speechSupported ? (
                <div className="flex justify-center">
                  <button onClick={handleRecord} className="flex flex-col items-center gap-2 group">
                    <div className="w-20 h-20 bg-red-50 group-hover:bg-red-100 rounded-full flex items-center justify-center transition-colors">
                      <Mic className="text-red-500" size={32} />
                    </div>
                    <span className="text-sm font-medium text-gray-700">Tap to Record</span>
                  </button>
                </div>
              ) : (
                <p className="text-xs text-amber-600 text-center mb-4">
                  当前浏览器不支持语音识别，请直接在下方文本框输入英文，或使用 Chrome / Edge 浏览器。
                </p>
              )}

              {/* Fallback manual text input — always available */}
              <div className="mt-4">
                <label className="text-xs text-gray-400 mb-1.5 block">手动输入 / Manual Input</label>
                <textarea
                  value={editedTranscript}
                  onChange={e => {
                    setEditedTranscript(e.target.value);
                    setTranscript(e.target.value);
                  }}
                  className="w-full h-28 p-3 border border-gray-200 rounded-xl text-sm text-gray-800 leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  placeholder="Type your answer here if speech recognition is unavailable..."
                />
                {editedTranscript.trim() && (
                  <button
                    onClick={handleGrade}
                    className="w-full mt-3 py-2.5 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors text-sm"
                  >
                    提交评估 Submit
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Recording in progress with live transcript */}
          {phase === 'recording' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-2 text-red-500">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </span>
                  <span className="text-sm font-medium">Listening... (tap stop when done)</span>
                </div>
                <button onClick={handleStopRecord} className="flex flex-col items-center gap-2 group">
                  <div className="w-20 h-20 bg-gray-100 group-hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors">
                    <MicOff className="text-gray-600" size={32} />
                  </div>
                  <span className="text-sm font-medium text-gray-700">Tap to Stop</span>
                </button>
                {/* Live transcript display — always visible during recording */}
                <div className="w-full mt-2 p-3 bg-gray-50 rounded-xl min-h-[60px]">
                  <p className="text-xs text-gray-400 mb-1">Live Transcript</p>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {interimText || <span className="text-gray-300">Start speaking...</span>}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Editable transcript + grade */}
          {transcript && phase !== 'grading' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-sm font-semibold text-gray-500 mb-2">Your Speech</h3>
              <p className="text-xs text-gray-400 mb-3">
                💡 提示：如果语音识别有误，可在框内手动修改文字后再提交。
              </p>
              <textarea
                value={editedTranscript}
                onChange={e => setEditedTranscript(e.target.value)}
                className="w-full h-32 p-3 border border-gray-200 rounded-xl text-sm text-gray-800 leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent mb-4"
                placeholder="Your recognized speech will appear here. Edit if needed."
              />
              <div className="flex gap-3">
                <button
                  onClick={handleRecord}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors text-sm"
                >
                  重新录音 Re-record
                </button>
                <button
                  onClick={handleGrade}
                  className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors text-sm"
                >
                  提交评估 Submit
                </button>
              </div>
            </div>
          )}

          {/* Streaming grading display */}
          {phase === 'grading' && streamingText && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-2 mb-3">
                <RefreshCw size={14} className="animate-spin text-gray-400" />
                <span className="text-sm font-semibold text-gray-500">Grading...</span>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{streamingText}</p>
            </div>
          )}
        </div>
      )}

      {/* Phase: feedback */}
      {phase === 'feedback' && feedback && (
        <div className="space-y-5">
          {/* Score */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center">
            <div className={`inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-3 ${
              feedback.score >= 80 ? 'bg-emerald-50' :
              feedback.score >= 60 ? 'bg-teal-50' :
              feedback.score >= 40 ? 'bg-amber-50' : 'bg-red-50'
            }`}>
              <span className={`text-2xl font-bold ${
                feedback.score >= 80 ? 'text-emerald-600' :
                feedback.score >= 60 ? 'text-teal-600' :
                feedback.score >= 40 ? 'text-amber-600' : 'text-red-600'
              }`}>
                {feedback.score}
              </span>
            </div>
            <p className="text-sm text-gray-500">Score</p>
          </div>

          {/* Transcript */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-500 mb-2">You said</h3>
            <p className="text-gray-800 leading-relaxed text-sm">"{editedTranscript || transcript}"</p>
          </div>

          {/* Grammar corrections */}
          {feedback.grammarCorrections.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-1.5">
                <AlertCircle size={15} className="text-amber-500" /> Grammar Corrections
              </h3>
              <ul className="space-y-2">
                {feedback.grammarCorrections.map((c, i) => (
                  <li key={i} className="text-sm text-gray-700 bg-amber-50 p-3 rounded-lg">{c}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Native Polish with async TTS */}
          {feedback.nativePolish && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-1.5">
                <Sparkles size={15} className="text-blue-500" /> Native Polish
              </h3>
              <p className="text-gray-800 leading-relaxed mb-4">"{feedback.nativePolish}"</p>
              {ttsSupported && (
                <button
                  onClick={handlePlayTTS}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-medium hover:bg-blue-100 transition-colors text-sm"
                >
                  <Volume2 size={18} /> Play Native Audio
                </button>
              )}
            </div>
          )}

          {/* Suggestions */}
          {feedback.suggestions.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-1.5">
                <CheckCircle2 size={15} className="text-emerald-500" /> Suggestions
              </h3>
              <ul className="space-y-2">
                {feedback.suggestions.map((s, i) => (
                  <li key={i} className="text-sm text-gray-700 bg-emerald-50 p-3 rounded-lg">{s}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Next button */}
          <button
            onClick={handleNext}
            className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
          >
            Next Round <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
