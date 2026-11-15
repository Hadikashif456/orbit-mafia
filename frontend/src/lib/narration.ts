/**
 * Speech synthesis narration module for English text.
 * Implements sentence-by-sentence sequential speech via onend
 * to prevent the Chrome speech cut-off bug on longer texts.
 * Plain text only.
 */

let unlocked = false;
let activeUtterance: SpeechSynthesisUtterance | null = null;
let pendingSentences: string[] = [];

/**
 * Checks if the browser supports window.speechSynthesis and SpeechSynthesisUtterance.
 */
export function isSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof window.SpeechSynthesisUtterance !== 'undefined'
  );
}

/**
 * Returns whether speech has been unlocked by user gesture prime().
 */
export function isUnlocked(): boolean {
  return unlocked;
}

/**
 * Returns whether narration is currently speaking an utterance.
 */
export function isSpeaking(): boolean {
  return activeUtterance !== null;
}

/**
 * Resets the module state for testing.
 */
export function resetStateForTesting(): void {
  unlocked = false;
  cancel();
}

/**
 * Primes speech synthesis inside a user gesture click by speaking an empty utterance.
 * Sets the module unlocked flag.
 */
export function prime(): void {
  if (!isSupported()) return;
  unlocked = true;
  try {
    const empty = new SpeechSynthesisUtterance('');
    empty.volume = 0;
    window.speechSynthesis.speak(empty);
  } catch {
    // Ignore priming errors in unsupported/restricted environments
  }
}

interface IntlSegmenter {
  new (locale: string, options: { granularity: string }): {
    segment(input: string): Iterable<{ segment: string }>;
  };
}

/**
 * Splits plain text into discrete sentences using ECMAScript Intl.Segmenter
 * with a fallback for environments without Segmenter. Correctly handles decimals
 * within numbers (e.g., CRI 86.6 or 3.14) without treating them as sentence boundaries.
 */
export function splitSentences(text: string): string[] {
  if (!text || typeof text !== 'string') return [];
  const trimmed = text.trim();
  if (!trimmed) return [];

  const maybeIntl = Intl as unknown as { Segmenter?: IntlSegmenter };
  if (typeof maybeIntl.Segmenter === 'function') {
    const segmenter = new maybeIntl.Segmenter('en', { granularity: 'sentence' });
    return Array.from(segmenter.segment(trimmed), (s) => s.segment.trim()).filter(Boolean);
  }

  return trimmed
    .split(/(?<=[.!?])\s+(?=[A-Z0-9]|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function getPreferredVoice(): SpeechSynthesisVoice | null {
  if (!isSupported()) return null;
  try {
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;
    return (
      voices.find((v) => v.lang.startsWith('en') && v.localService) ||
      voices.find((v) => v.lang.startsWith('en')) ||
      null
    );
  } catch {
    return null;
  }
}

function speakNext(): void {
  if (pendingSentences.length === 0) {
    activeUtterance = null;
    return;
  }

  const nextText = pendingSentences.shift()!;
  try {
    const utterance = new SpeechSynthesisUtterance(nextText);
    utterance.lang = 'en-US';
    const voice = getPreferredVoice();
    if (voice) {
      utterance.voice = voice;
    }

    utterance.onend = () => {
      speakNext();
    };

    utterance.onerror = () => {
      pendingSentences = [];
      activeUtterance = null;
    };

    activeUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  } catch {
    pendingSentences = [];
    activeUtterance = null;
  }
}

/**
 * Cancels any active speech and clears pending sentence queue.
 */
export function cancel(): void {
  pendingSentences = [];
  activeUtterance = null;
  if (isSupported()) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore cancel errors
    }
  }
}

/**
 * Speaks the provided plain text sentence-by-sentence.
 * Does nothing until prime() has unlocked speech synthesis.
 */
export function speak(text: string): void {
  if (!isSupported() || !unlocked) return;
  if (!text || typeof text !== 'string') return;

  cancel();

  const sentences = splitSentences(text);
  if (sentences.length === 0) return;

  pendingSentences = sentences;
  speakNext();
}

/**
 * Formats a scenario alert for narration:
 * "Sol {sol}. Crew {crewId}, {severity} alert. CRI {criFrom} to {criTo}. {alert.message}"
 */
export function formatAlertNarration(
  sol: number,
  alert: {
    crewId: string;
    severity: string;
    criFrom: number;
    criTo: number;
    message: string;
  }
): string {
  return `Sol ${sol}. Crew ${alert.crewId}, ${alert.severity} alert. CRI ${alert.criFrom} to ${alert.criTo}. ${alert.message}`;
}

/**
 * Formats Copilot countermeasure guidance for narration:
 * Speaks summary, each action title, "Sources are shown on screen." and the disclaimer.
 */
export function formatCopilotNarration(data: {
  summary: string;
  suggestedActions: Array<{ title: string }>;
  disclaimer: string;
}): string {
  const pieces = [
    data.summary,
    ...data.suggestedActions.map((a) => a.title),
    'Sources are shown on screen.',
    data.disclaimer,
  ];
  return pieces
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => (/[.!?]$/.test(p) ? p : `${p}.`))
    .join(' ');
}

/**
 * Formats AlertScreen Copilot explanation for narration:
 * Speaks summary, drivers, action titles, and disclaimer.
 */
export function formatAlertScreenNarration(data: {
  summary: string;
  drivers: string[];
  suggestedActions: Array<{ title: string }>;
  disclaimer: string;
}): string {
  const driversText = data.drivers.length > 0 ? `Drivers: ${data.drivers.join(', ')}` : '';
  const pieces = [
    data.summary,
    driversText,
    ...data.suggestedActions.map((a) => a.title),
    data.disclaimer,
  ];
  return pieces
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => (/[.!?]$/.test(p) ? p : `${p}.`))
    .join(' ');
}
