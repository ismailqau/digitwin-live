'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.ErrorCode = void 0;
var ErrorCode;
(function (ErrorCode) {
  // Authentication errors
  ErrorCode['UNAUTHORIZED'] = 'UNAUTHORIZED';
  ErrorCode['FORBIDDEN'] = 'FORBIDDEN';
  ErrorCode['INVALID_TOKEN'] = 'INVALID_TOKEN';
  // Validation errors
  ErrorCode['VALIDATION_ERROR'] = 'VALIDATION_ERROR';
  ErrorCode['INVALID_INPUT'] = 'INVALID_INPUT';
  // Service errors
  ErrorCode['ASR_ERROR'] = 'ASR_ERROR';
  ErrorCode['RAG_ERROR'] = 'RAG_ERROR';
  ErrorCode['LLM_ERROR'] = 'LLM_ERROR';
  ErrorCode['TTS_ERROR'] = 'TTS_ERROR';
  ErrorCode['LIPSYNC_ERROR'] = 'LIPSYNC_ERROR';
  // Resource errors
  ErrorCode['NOT_FOUND'] = 'NOT_FOUND';
  ErrorCode['ALREADY_EXISTS'] = 'ALREADY_EXISTS';
  ErrorCode['RESOURCE_EXHAUSTED'] = 'RESOURCE_EXHAUSTED';
  // Network errors
  ErrorCode['CONNECTION_ERROR'] = 'CONNECTION_ERROR';
  ErrorCode['TIMEOUT'] = 'TIMEOUT';
  // Rate limiting
  ErrorCode['RATE_LIMIT_EXCEEDED'] = 'RATE_LIMIT_EXCEEDED';
  // Internal errors
  ErrorCode['INTERNAL_ERROR'] = 'INTERNAL_ERROR';
  ErrorCode['UNKNOWN_ERROR'] = 'UNKNOWN_ERROR';
})(ErrorCode || (exports.ErrorCode = ErrorCode = {}));
//# sourceMappingURL=errors.js.map
