import { validateEnv } from './env';

const base = { MONGODB_URI: 'mongodb://x/db', JWT_SECRET: 's' };

describe('validateEnv', () => {
  it('applies defaults', () => {
    expect(validateEnv(base)).toEqual({
      PORT: 3000,
      MONGODB_URI: 'mongodb://x/db',
      JWT_SECRET: 's',
      CLIENT_ORIGIN: 'http://localhost:4200',
      UPLOAD_DIR: 'uploads',
    });
  });
  it.each(['MONGODB_URI', 'JWT_SECRET'])('requires %s', (name) => {
    expect(() => validateEnv({ ...base, [name]: '' })).toThrow(name);
  });
  it('rejects a bad port', () => {
    expect(() => validateEnv({ ...base, PORT: 'abc' })).toThrow('PORT');
  });
});
