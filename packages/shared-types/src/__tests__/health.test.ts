// Example test for shared types
describe('shared types Health Check', () => {
  it('should pass basic test', () => {
    expect(true).toBe(true);
  });

  it('should have test environment configured', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});
