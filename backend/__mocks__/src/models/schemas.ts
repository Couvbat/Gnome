// Manual mock for database schemas
const mockCasinoSession = {
  findOne: jest.fn(),
  create: jest.fn(),
  updateOne: jest.fn()
};

const mockCasinoGameLog = {
  findOne: jest.fn(),
  create: jest.fn()
};

export const CasinoSession = mockCasinoSession;
export const CasinoGameLog = mockCasinoGameLog;
