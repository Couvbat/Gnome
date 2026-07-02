import { vi } from 'vitest';

// Manual mock for database models
const mockUser = {
  findOne: vi.fn(),
  create: vi.fn(),
  updateOne: vi.fn(),
  findOneAndUpdate: vi.fn()
};

const mockCharacter = {
  findOne: vi.fn(),
  create: vi.fn(),
  updateOne: vi.fn(),
  findOneAndUpdate: vi.fn()
};

const mockCasinoProfile = {
  findOne: vi.fn(),
  create: vi.fn(),
  updateOne: vi.fn(),
  findOneAndUpdate: vi.fn()
};

export const User = mockUser;
export const Character = mockCharacter;
export const CasinoProfile = mockCasinoProfile;
