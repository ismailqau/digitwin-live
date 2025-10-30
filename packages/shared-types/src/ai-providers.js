'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.TTSProvider = exports.LLMProvider = void 0;
var LLMProvider;
(function (LLMProvider) {
  LLMProvider['GEMINI_FLASH'] = 'gemini-flash';
  LLMProvider['GEMINI_PRO'] = 'gemini-pro';
  LLMProvider['GPT4_TURBO'] = 'gpt4-turbo';
  LLMProvider['GPT4'] = 'gpt4';
  LLMProvider['GROQ_LLAMA'] = 'groq-llama';
})(LLMProvider || (exports.LLMProvider = LLMProvider = {}));
var TTSProvider;
(function (TTSProvider) {
  TTSProvider['XTTS_V2'] = 'xtts-v2';
  TTSProvider['GOOGLE_CLOUD_TTS'] = 'google-cloud-tts';
  TTSProvider['OPENAI_TTS'] = 'openai-tts';
})(TTSProvider || (exports.TTSProvider = TTSProvider = {}));
//# sourceMappingURL=ai-providers.js.map
