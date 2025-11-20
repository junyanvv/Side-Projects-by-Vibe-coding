
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { WordDefinition, SupportedLanguage, AdditionalMeaning, StoryQuiz } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// Helper to decode base64 audio
const decodeAudio = (base64: string) => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

// Retrieve word definition, translation, and details
export const getWordDetails = async (
  word: string, 
  targetLanguage: SupportedLanguage,
  nativeLanguage: SupportedLanguage
): Promise<WordDefinition> => {
  const prompt = `
    You are a world-class linguist.
    Analyze the word "${word}".
    
    User Context:
    - Native Language: ${nativeLanguage} (The user speaks this).
    - Explanation Language: ${targetLanguage} (The user wants definitions in this language).

    Provide the following details in JSON format:
    1. The word itself (corrected if misspelled).
    2. Phonetic transcription (IPA).
    3. Part of speech (translated into ${targetLanguage}).
    4. A clear, concise definition explained in ${targetLanguage}.
    5. A definition in the word's original language (e.g. if word is "Gato", this is Spanish).
    6. Three distinct example sentences using the word. (Provide the sentence in the original language, followed by a translation in ${nativeLanguage} in parentheses).
    7. Five synonyms.
    8. A brief etymology (origin) of the word explained in ${targetLanguage}.
    9. "Vibe check": 1 or 2 short sentences describing the typical usage context, tone, or social circumstances (e.g., "Formal business contexts", "Playful slang between friends"). Explain in ${targetLanguage}.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING },
          phonetic: { type: Type.STRING },
          partOfSpeech: { type: Type.STRING },
          definition: { type: Type.STRING, description: `Definition in ${targetLanguage}` },
          originalDefinition: { type: Type.STRING, description: "Definition in original language" },
          examples: { type: Type.ARRAY, items: { type: Type.STRING } },
          synonyms: { type: Type.ARRAY, items: { type: Type.STRING } },
          etymology: { type: Type.STRING, description: `Etymology in ${targetLanguage}` },
          vibes: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Usage context/tone" },
        },
        required: ["word", "phonetic", "partOfSpeech", "definition", "originalDefinition", "examples", "synonyms", "etymology", "vibes"],
      },
    },
  });

  if (!response.text) {
    throw new Error("Failed to generate definition.");
  }

  return JSON.parse(response.text) as WordDefinition;
};

// Fetch additional nuances or specialized meanings
export const getAdditionalMeanings = async (word: string, targetLanguage: SupportedLanguage): Promise<AdditionalMeaning[]> => {
  const prompt = `
    Analyze the word "${word}".
    The user wants to know 3 "hidden gems" or interesting facts about this word.
    Do NOT provide standard definitions.
    Provide 3 distinct items, such as:
    1. A common idiom or slang usage.
    2. A surprising origin or etymology fact.
    3. A specific cultural reference or "street" nuance.
    
    Explain in ${targetLanguage}.
    Return JSON format with:
    - 'context' (Short label like "Idiom", "History", "Slang" - translated to ${targetLanguage})
    - 'definition' (The interesting fact or explanation in ${targetLanguage}).
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            context: { type: Type.STRING, description: "Label for this fact (e.g. 'Idiom')" },
            definition: { type: Type.STRING, description: "The explanation" },
          },
          required: ["context", "definition"],
        },
      },
    },
  });

  if (!response.text) {
    return [];
  }

  return JSON.parse(response.text) as AdditionalMeaning[];
};

// Generate an image representing the word
export const generateWordImage = async (word: string, promptContext?: string): Promise<string> => {
  try {
    // Strict instruction to remove text
    const basePrompt = `A high-quality artistic illustration of the concept "${word}". IMPORTANT: Do NOT include any text, letters, labels, or words in the image. Pure visual representation only.`;
    const fullPrompt = promptContext 
      ? `${basePrompt} Context: ${promptContext}. Vivid, distinct visual style.`
      : `${basePrompt} Minimalist, solid, clean composition.`;

    // Using Imagen for high quality visualization
    const response = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: fullPrompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '4:3',
      },
    });

    const base64ImageBytes = response.generatedImages?.[0]?.image?.imageBytes;
    if (!base64ImageBytes) throw new Error("No image generated");
    
    return `data:image/jpeg;base64,${base64ImageBytes}`;
  } catch (error) {
    console.error("Imagen failed", error);
    return ""; 
  }
};

// Generate a practice story using saved words
export const generateStoryFromWords = async (words: string[], targetLanguage: SupportedLanguage): Promise<StoryQuiz> => {
  // Select random subset if too many words (max 8)
  const subset = words.length > 8 ? words.sort(() => 0.5 - Math.random()).slice(0, 8) : words;
  
  const prompt = `
    Create a creative, coherent, and short story (approx 150 words) that includes the following words exactly: ${subset.join(', ')}.
    
    IMPORTANT FORMATTING INSTRUCTION:
    Whenever one of the requested words (or a grammatical variation of it) appears in the story, wrap it in double curly braces. 
    Example: "The {{cat}} sat on the {{mat}}."
    
    The story should be written in the words' original language (usually English), but make it simple enough for learners.
    
    Return JSON with:
    1. 'title': A creative title for the story.
    2. 'content': The story text with the {{word}} formatting.
    3. 'wordsUsed': The list of words from the input that were successfully included.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          content: { type: Type.STRING, description: "Story text with {{word}} placeholders" },
          wordsUsed: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["title", "content", "wordsUsed"],
      },
    },
  });

  if (!response.text) {
    throw new Error("Failed to generate story");
  }

  return JSON.parse(response.text) as StoryQuiz;
};

// Chat with the AI about the word
export const chatAboutWord = async (
  history: { role: 'user' | 'model'; text: string }[],
  message: string,
  currentWord: string,
  targetLanguage: string,
  nativeLanguage: string
) => {
  const chat = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: `You are a helpful dictionary assistant. The user is currently looking at the word "${currentWord}". 
      User Profile:
      - Native Language: ${nativeLanguage}
      - Learning/Explanation Language: ${targetLanguage}

      Answer their questions about grammar, usage, nuance, or culture related to this word. 
      Keep answers concise and helpful.
      Ensure all explanations are in ${targetLanguage}, unless the user asks for a translation to their native language.`,
    },
    history: history.map(h => ({
      role: h.role,
      parts: [{ text: h.text }],
    })),
  });

  const response = await chat.sendMessage({ message });
  return response.text;
};

// Text-to-Speech
export const playPronunciation = async (text: string) => {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' }, // Kore is usually good for clarity
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) return;

  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  const audioBuffer = await decodeAudioData(decodeAudio(base64Audio), audioContext);
  
  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);
  source.start();
};

async function decodeAudioData(
  bytes: Uint8Array,
  ctx: AudioContext
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(bytes.buffer);
  const numChannels = 1;
  const sampleRate = 24000;
  const frameCount = dataInt16.length / numChannels;
  
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}
