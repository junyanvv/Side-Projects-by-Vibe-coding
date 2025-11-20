
export interface WordDefinition {
  word: string;
  phonetic: string;
  partOfSpeech: string;
  definition: string;
  originalDefinition: string;
  examples: string[];
  synonyms: string[];
  etymology: string;
  vibes: string[];
}

export interface AdditionalMeaning {
  context: string;
  definition: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
}

export interface SavedItem {
  id: string;
  word: string;
  imageUrl: string;
  definition: string;
  timestamp: number;
}

export interface StoryQuiz {
  title: string;
  content: string; // Contains words wrapped in {{word}}
  wordsUsed: string[];
}

export enum SupportedLanguage {
  ENGLISH = 'English',
  SPANISH = 'Spanish',
  FRENCH = 'French',
  GERMAN = 'German',
  CHINESE = 'Chinese (Simplified)',
  JAPANESE = 'Japanese',
  KOREAN = 'Korean',
  HINDI = 'Hindi',
  ARABIC = 'Arabic',
  PORTUGUESE = 'Portuguese',
  RUSSIAN = 'Russian',
  ITALIAN = 'Italian'
}