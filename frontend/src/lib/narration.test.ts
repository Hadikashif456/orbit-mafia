import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isSupported,
  isUnlocked,
  prime,
  speak,
  cancel,
  splitSentences,
  formatAlertNarration,
  formatCopilotNarration,
  formatAlertScreenNarration,
  resetStateForTesting,
} from './narration';

class MockSpeechSynthesisUtterance {
  text: string;
  lang: string = '';
  voice: any = null;
  volume: number = 1;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(text: string = '') {
    this.text = text;
  }
}

interface MockSpeechSynthesis {
  speak: ReturnType<typeof vi.fn>;
  cancel: ReturnType<typeof vi.fn>;
  getVoices: ReturnType<typeof vi.fn>;
}

describe('narration module', () => {
  let mockSpeechSynthesis: MockSpeechSynthesis;

  beforeEach(() => {
    mockSpeechSynthesis = {
      speak: vi.fn((utterance: MockSpeechSynthesisUtterance) => {
        if (utterance.onend) {
          utterance.onend();
        }
      }),
      cancel: vi.fn(),
      getVoices: vi.fn(() => [
        { name: 'Local Voice', lang: 'en-US', localService: true },
        { name: 'Remote Voice', lang: 'en-GB', localService: false },
      ]),
    };

    (globalThis as any).window = {
      speechSynthesis: mockSpeechSynthesis,
      SpeechSynthesisUtterance: MockSpeechSynthesisUtterance,
    };
    (globalThis as any).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;

    resetStateForTesting();
  });

  afterEach(() => {
    resetStateForTesting();
    vi.clearAllMocks();
  });

  it('isSupported() returns true when speechSynthesis is present and false otherwise', () => {
    expect(isSupported()).toBe(true);

    const origWindow = (globalThis as any).window;
    delete (globalThis as any).window;
    expect(isSupported()).toBe(false);
    (globalThis as any).window = origWindow;
  });

  it('speak() is not called before prime()', () => {
    expect(isUnlocked()).toBe(false);
    speak('Mission Sol 144 telemetry alert.');
    expect(mockSpeechSynthesis.speak).not.toHaveBeenCalled();

    // After prime(), speech is unlocked
    prime();
    expect(isUnlocked()).toBe(true);
    expect(mockSpeechSynthesis.speak).toHaveBeenCalledWith(
      expect.objectContaining({ text: '' })
    );

    mockSpeechSynthesis.speak.mockClear();
    speak('Mission Sol 144 telemetry alert.');
    expect(mockSpeechSynthesis.speak).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Mission Sol 144 telemetry alert.', lang: 'en-US' })
    );
  });

  it('each alert id is spoken once', () => {
    prime();
    mockSpeechSynthesis.speak.mockClear();

    const spokenAlertIds = new Set<string>();

    const alertsBatch1 = [
      {
        id: 'alert-c002-144',
        crewId: 'C002',
        severity: 'warning',
        criFrom: 86.6,
        criTo: 61.9,
        message: 'CRI drop detected for C002.',
      },
    ];

    // First appearance of alert-c002-144
    for (const alert of alertsBatch1) {
      if (!spokenAlertIds.has(alert.id)) {
        spokenAlertIds.add(alert.id);
        speak(formatAlertNarration(144, alert));
      }
    }

    // The sentence-splitting speech speaks each sentence sequentially
    expect(mockSpeechSynthesis.speak).toHaveBeenCalled();
    const spokenCall1 = mockSpeechSynthesis.speak.mock.calls
      .map(([utt]) => utt.text)
      .join(' ');
    expect(spokenCall1).toBe(
      'Sol 144. Crew C002, warning alert. CRI 86.6 to 61.9. CRI drop detected for C002.'
    );

    mockSpeechSynthesis.speak.mockClear();

    // Second render / sol update: alert-c002-144 remains active, and a new alert-c003-145 arrives
    const alertsBatch2 = [
      {
        id: 'alert-c002-144',
        crewId: 'C002',
        severity: 'warning',
        criFrom: 86.6,
        criTo: 61.9,
        message: 'CRI drop detected for C002.',
      },
      {
        id: 'alert-c003-145',
        crewId: 'C003',
        severity: 'watch',
        criFrom: 91.9,
        criTo: 78.4,
        message: 'Sleep restriction noted.',
      },
    ];

    for (const alert of alertsBatch2) {
      if (!spokenAlertIds.has(alert.id)) {
        spokenAlertIds.add(alert.id);
        speak(formatAlertNarration(145, alert));
      }
    }

    // Only alert-c003-145 should be spoken (alert-c002-144 was already spoken)
    expect(spokenAlertIds.size).toBe(2);
    expect(mockSpeechSynthesis.speak).toHaveBeenCalled();
    const spokenCall2 = mockSpeechSynthesis.speak.mock.calls
      .map(([utt]) => utt.text)
      .join(' ');
    expect(spokenCall2).toBe(
      'Sol 145. Crew C003, watch alert. CRI 91.9 to 78.4. Sleep restriction noted.'
    );
  });

  it('cancel() is called on slider change and reset', () => {
    prime();
    mockSpeechSynthesis.cancel.mockClear();

    // Simulate slider change
    const onSliderChange = () => {
      cancel();
    };
    onSliderChange();
    expect(mockSpeechSynthesis.cancel).toHaveBeenCalledTimes(1);

    mockSpeechSynthesis.cancel.mockClear();

    // Simulate reset
    const onReset = () => {
      cancel();
    };
    onReset();
    expect(mockSpeechSynthesis.cancel).toHaveBeenCalledTimes(1);
  });

  it('text spoken equals the response text plus the fixed phrases', () => {
    prime();
    mockSpeechSynthesis.speak.mockClear();

    const mockCopilotResponse = {
      summary: 'Crew member C002 exhibits cardiovascular strain following the radiation spike.',
      drivers: ['Cardiovascular strain', 'Radiation exposure'],
      suggestedActions: [
        {
          title: 'Targeted Aerobic Countermeasure',
          protocol: 'Zone 2 cycling for 30 minutes',
          source: 'NASA HRP Standard Protocols',
        },
        {
          title: 'Sleep Hygiene Schedule',
          protocol: 'Dim cabin illumination 60 minutes before rest',
          source: 'NASA HRP Sleep Standards',
        },
      ],
      disclaimer: 'Risk flags and suggested countermeasures only. Not a medical diagnosis.',
      groundedIn: ['countermeasures.md#sleep', 'countermeasures.md#exercise'],
      mode: 'live' as const,
    };

    const formatted = formatCopilotNarration(mockCopilotResponse);

    // Verify raw text components
    expect(formatted).toContain(mockCopilotResponse.summary);
    expect(formatted).toContain('Targeted Aerobic Countermeasure');
    expect(formatted).toContain('Sleep Hygiene Schedule');
    expect(formatted).toContain('Sources are shown on screen.');
    expect(formatted).toContain(mockCopilotResponse.disclaimer);

    // Speak formatted text and inspect utterances
    speak(formatted);
    const spokenTexts = mockSpeechSynthesis.speak.mock.calls.map(([utt]) => utt.text);
    const fullSpoken = spokenTexts.join(' ');

    expect(fullSpoken).toContain(mockCopilotResponse.summary);
    expect(fullSpoken).toContain('Targeted Aerobic Countermeasure');
    expect(fullSpoken).toContain('Sleep Hygiene Schedule');
    expect(fullSpoken).toContain('Sources are shown on screen.');
    expect(fullSpoken).toContain(mockCopilotResponse.disclaimer);
  });

  it('splitSentences correctly breaks text without cutting off Chrome utterances', () => {
    const text = 'First sentence. Second sentence! Third sentence? Fourth sentence';
    const result = splitSentences(text);
    expect(result).toEqual([
      'First sentence.',
      'Second sentence!',
      'Third sentence?',
      'Fourth sentence',
    ]);
  });

  it('formatAlertScreenNarration formats summary, drivers, action titles, and disclaimer', () => {
    const data = {
      summary: 'Cardiovascular warning detected.',
      drivers: ['Cardiovascular strain', 'Sleep deficit'],
      suggestedActions: [
        { title: 'Rest and Hydration' },
        { title: 'Electrolyte Balance' },
      ],
      disclaimer: 'Not a medical diagnosis.',
    };

    const formatted = formatAlertScreenNarration(data);
    expect(formatted).toContain('Cardiovascular warning detected.');
    expect(formatted).toContain('Drivers: Cardiovascular strain, Sleep deficit');
    expect(formatted).toContain('Rest and Hydration');
    expect(formatted).toContain('Electrolyte Balance');
    expect(formatted).toContain('Not a medical diagnosis.');
  });
});
