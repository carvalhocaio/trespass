export const TEST_ENV = {
  CORS_ORIGIN: "http://localhost:3001",
  BETTER_AUTH_URL: "http://localhost:3000",
  BETTER_AUTH_SECRET: "test-secret-exactly-32-chars-123",
  DATABASE_URL: "postgresql://test:test@localhost:5432/test",
  GITHUB_CLIENT_ID: "test",
  GITHUB_CLIENT_SECRET: "test",
  SECRET_ENCRYPTION_KEY: "a".repeat(64),
  LOG_LEVEL: "silent",
};
