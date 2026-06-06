// Must run before any module import so env.ts validation passes
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.JWT_SECRET = 'test-secret-key-minimum-sixteen-chars-long';
process.env.JWT_EXPIRES_IN = '1h';
process.env.GROQ_API_KEY = 'gsk_test_key_placeholder';
process.env.RESEND_API_KEY = '';
process.env.RESEND_FROM_EMAIL = 'test@example.com';
process.env.CANDIDATE_NAME = 'Aman Kundu';
process.env.CANDIDATE_EMAIL = 'amankundu369@gmail.com';
process.env.REPOSITORY_URL = 'https://github.com/test/repo';
process.env.DEPLOYED_URL = 'https://test.example.com';
process.env.PORT = '3001';
