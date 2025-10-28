export declare enum LLMProvider {
    GEMINI_FLASH = "gemini-flash",
    GEMINI_PRO = "gemini-pro",
    GPT4_TURBO = "gpt4-turbo",
    GPT4 = "gpt4",
    GROQ_LLAMA = "groq-llama"
}
export declare enum TTSProvider {
    XTTS_V2 = "xtts-v2",
    GOOGLE_CLOUD_TTS = "google-cloud-tts",
    OPENAI_TTS = "openai-tts"
}
export interface LLMConfig {
    provider: LLMProvider;
    model: string;
    temperature: number;
    maxTokens: number;
    stopSequences?: string[];
    streamingEnabled: boolean;
}
export interface LLMContext {
    systemPrompt: string;
    userPersonality: string;
    relevantKnowledge: string[];
    conversationHistory: string;
    currentQuery: string;
}
//# sourceMappingURL=ai-providers.d.ts.map