// Test data factories

export const createMockUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockConversation = (overrides = {}) => ({
  id: 'test-conversation-id',
  userId: 'test-user-id',
  title: 'Test Conversation',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockMessage = (overrides = {}) => ({
  id: 'test-message-id',
  conversationId: 'test-conversation-id',
  role: 'user' as const,
  content: 'Test message',
  createdAt: new Date(),
  ...overrides,
});

export const createMockVoiceModel = (overrides = {}) => ({
  id: 'test-voice-model-id',
  userId: 'test-user-id',
  name: 'Test Voice Model',
  status: 'completed' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockFaceModel = (overrides = {}) => ({
  id: 'test-face-model-id',
  userId: 'test-user-id',
  name: 'Test Face Model',
  status: 'completed' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockDocument = (overrides = {}) => ({
  id: 'test-document-id',
  userId: 'test-user-id',
  title: 'Test Document',
  content: 'Test content',
  status: 'processed' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});
