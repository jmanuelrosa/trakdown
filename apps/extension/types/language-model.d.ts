// Chrome's built-in Prompt API (Gemini Nano).
// Available on Chrome 138+ when on-device AI is enabled.
// API: https://developer.chrome.com/docs/ai/prompt-api

type LanguageModelAvailability = "available" | "downloadable" | "downloading" | "unavailable";

interface LanguageModelInitialPrompt {
  role: "system" | "user" | "assistant";
  content: string;
}

interface LanguageModelCreateOptions {
  initialPrompts?: LanguageModelInitialPrompt[];
  temperature?: number;
  topK?: number;
  signal?: AbortSignal;
}

interface LanguageModelSession {
  prompt(input: string, options?: { signal?: AbortSignal }): Promise<string>;
  promptStreaming(input: string, options?: { signal?: AbortSignal }): ReadableStream<string>;
  destroy(): void;
  clone(): Promise<LanguageModelSession>;
}

interface LanguageModelStatic {
  availability(): Promise<LanguageModelAvailability>;
  create(options?: LanguageModelCreateOptions): Promise<LanguageModelSession>;
}

declare const LanguageModel: LanguageModelStatic | undefined;

// Older spec compatibility: window.ai.languageModel
interface Window {
  ai?: {
    languageModel?: LanguageModelStatic;
  };
}
