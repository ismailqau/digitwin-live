import { RateLimitService } from '../../services/rateLimit.service';

describe('RateLimitService', () => {
  let rateLimitService: RateLimitService;
  const mockPrisma = {
    rateLimit: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rateLimitService = new RateLimitService(mockPrisma as any);
  });

  describe('checkRateLimit', () => {
    it('should allow first request when no record exists', async () => {
      mockPrisma.rateLimit.findFirst.mockResolvedValue(null);
      mockPrisma.rateLimit.create.mockResolvedValue({
        id: 'test-id',
        userId: 'user-1',
        endpoint: '/api/v1/documents',
        windowStart: new Date(),
        requestCount: 1,
      });

      const result = await rateLimitService.checkRateLimit('user-1', '/api/v1/documents', 'free');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(99); // 100 - 1
      expect(result.resetAt).toBeDefined();
      expect(mockPrisma.rateLimit.create).toHaveBeenCalled();
    });

    it('should increment request count when within limit', async () => {
      const now = new Date();
      mockPrisma.rateLimit.findFirst.mockResolvedValue({
        id: 'test-id',
        userId: 'user-1',
        endpoint: '/api/v1/documents',
        windowStart: now,
        requestCount: 50,
      });
      mockPrisma.rateLimit.update.mockResolvedValue({
        id: 'test-id',
        requestCount: 51,
      });

      const result = await rateLimitService.checkRateLimit('user-1', '/api/v1/documents', 'free');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(49); // 100 - 51
      expect(mockPrisma.rateLimit.update).toHaveBeenCalled();
    });

    it('should reject request when limit exceeded', async () => {
      const now = new Date();
      mockPrisma.rateLimit.findFirst.mockResolvedValue({
        id: 'test-id',
        userId: 'user-1',
        endpoint: '/api/v1/documents',
        windowStart: now,
        requestCount: 100, // Already at limit
      });

      const result = await rateLimitService.checkRateLimit('user-1', '/api/v1/documents', 'free');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeDefined();
    });

    it('should allow unlimited requests for enterprise tier', async () => {
      const result = await rateLimitService.checkRateLimit(
        'user-1',
        '/api/v1/documents',
        'enterprise'
      );

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should use 1-minute window for upload endpoints', async () => {
      mockPrisma.rateLimit.findFirst.mockResolvedValue(null);
      mockPrisma.rateLimit.create.mockResolvedValue({
        id: 'test-id',
        userId: 'user-1',
        endpoint: '/api/v1/documents/upload',
        windowStart: new Date(),
        requestCount: 1,
      });

      const result = await rateLimitService.checkRateLimit(
        'user-1',
        '/api/v1/documents/upload',
        'free'
      );

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9); // 10 - 1 for upload endpoint
    });

    it('should use 1-minute window for search endpoints', async () => {
      mockPrisma.rateLimit.findFirst.mockResolvedValue(null);
      mockPrisma.rateLimit.create.mockResolvedValue({
        id: 'test-id',
        userId: 'user-1',
        endpoint: '/api/v1/documents/search',
        windowStart: new Date(),
        requestCount: 1,
      });

      const result = await rateLimitService.checkRateLimit(
        'user-1',
        '/api/v1/documents/search',
        'free'
      );

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(29); // 30 - 1 for search endpoint
    });
  });

  describe('checkConversationTimeLimit', () => {
    it('should allow conversation within daily limit', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        conversationMinutesUsed: 30,
        subscriptionTier: 'free',
      });

      const result = await rateLimitService.checkConversationTimeLimit('user-1', 'free', 10);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(20); // 60 - 30 - 10
    });

    it('should reject conversation exceeding daily limit', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        conversationMinutesUsed: 55,
        subscriptionTier: 'free',
      });

      const result = await rateLimitService.checkConversationTimeLimit('user-1', 'free', 10);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(5); // 60 - 55
      expect(result.retryAfter).toBeDefined();
    });

    it('should allow unlimited conversation for pro tier', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        conversationMinutesUsed: 1000,
        subscriptionTier: 'pro',
      });

      const result = await rateLimitService.checkConversationTimeLimit('user-1', 'pro', 1000);

      expect(result.allowed).toBe(true);
    });

    it('should throw error if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        rateLimitService.checkConversationTimeLimit('user-1', 'free', 10)
      ).rejects.toThrow('User not found');
    });
  });

  describe('updateConversationMinutes', () => {
    it('should increment conversation minutes', async () => {
      mockPrisma.user.update.mockResolvedValue({
        id: 'user-1',
        conversationMinutesUsed: 35,
      });

      await rateLimitService.updateConversationMinutes('user-1', 5);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          conversationMinutesUsed: {
            increment: 5,
          },
        },
      });
    });
  });

  describe('getUserRateLimitStats', () => {
    it('should return correct stats for free tier user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        subscriptionTier: 'free',
        conversationMinutesUsed: 30,
      });

      const stats = await rateLimitService.getUserRateLimitStats('user-1');

      expect(stats.subscriptionTier).toBe('free');
      expect(stats.conversationMinutesLimit).toBe(60);
      expect(stats.conversationMinutesUsed).toBe(30);
      expect(stats.conversationMinutesRemaining).toBe(30);
      expect(stats.apiRequestsPerHourLimit).toBe(100);
      expect(stats.uploadRequestsPerMinuteLimit).toBe(10);
      expect(stats.searchRequestsPerMinuteLimit).toBe(30);
    });

    it('should return unlimited stats for enterprise tier', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        subscriptionTier: 'enterprise',
        conversationMinutesUsed: 0,
      });

      const stats = await rateLimitService.getUserRateLimitStats('user-1');

      expect(stats.subscriptionTier).toBe('enterprise');
      expect(stats.conversationMinutesLimit).toBe(Number.MAX_SAFE_INTEGER);
      expect(stats.apiRequestsPerHourLimit).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should throw error if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(rateLimitService.getUserRateLimitStats('user-1')).rejects.toThrow(
        'User not found'
      );
    });
  });

  describe('cleanupExpiredRecords', () => {
    it('should delete expired rate limit records', async () => {
      mockPrisma.rateLimit.deleteMany.mockResolvedValue({ count: 10 });

      await rateLimitService.cleanupExpiredRecords();

      expect(mockPrisma.rateLimit.deleteMany).toHaveBeenCalled();
      const call = mockPrisma.rateLimit.deleteMany.mock.calls[0][0];
      expect(call.where.windowStart.lt).toBeDefined();
    });
  });

  describe('resetDailyConversationMinutes', () => {
    it('should reset conversation minutes for all users', async () => {
      mockPrisma.user.updateMany.mockResolvedValue({ count: 100 });

      await rateLimitService.resetDailyConversationMinutes();

      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
        data: {
          conversationMinutesUsed: 0,
        },
      });
    });
  });
});
