import jwt from 'jsonwebtoken';

export const TEST_USER = {
  id: 'd4e5f6a7-b8c9-0123-defa-b01234567890',
  email: 'test@example.com',
  name: 'Test User',
  passwordHash: '$2b$12$hashedpassword',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

export const OTHER_USER = {
  id: 'e5f6a7b8-c9d0-1234-efab-c01234567891',
  email: 'other@example.com',
  name: 'Other User',
  passwordHash: '$2b$12$hashedpassword',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

export function generateToken(userId = TEST_USER.id, email = TEST_USER.email): string {
  return jwt.sign(
    { userId, email },
    process.env.JWT_SECRET!,
    { expiresIn: '1h' }
  );
}

export const AUTH_HEADER = `Bearer ${generateToken()}`;
