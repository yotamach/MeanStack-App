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
      LOG_LEVEL: 'info',
      TRUST_PROXY: 0,
    });
  });
  it.each(['MONGODB_URI', 'JWT_SECRET'])('requires %s', (name) => {
    expect(() => validateEnv({ ...base, [name]: '' })).toThrow(name);
  });
  it('rejects a bad port', () => {
    expect(() => validateEnv({ ...base, PORT: 'abc' })).toThrow('PORT');
  });
  it('parses TRUST_PROXY and rejects invalid values', () => {
    expect(validateEnv({ ...base, TRUST_PROXY: '1' }).TRUST_PROXY).toBe(1);
    expect(() => validateEnv({ ...base, TRUST_PROXY: '-1' })).toThrow('TRUST_PROXY');
    expect(() => validateEnv({ ...base, TRUST_PROXY: 'yes' })).toThrow('TRUST_PROXY');
  });

  describe('JWT_SECRET strength', () => {
    const prod = { ...base, NODE_ENV: 'production' };
    it('is not enforced outside production', () => {
      expect(validateEnv({ ...base, JWT_SECRET: 'short' }).JWT_SECRET).toBe('short');
    });
    it('must be long in production', () => {
      expect(() => validateEnv({ ...prod, JWT_SECRET: 'too-short' })).toThrow('too weak');
    });
    it('must not be the .env.example placeholder in production', () => {
      expect(() =>
        validateEnv({ ...prod, JWT_SECRET: 'change-me-to-a-long-random-string' }),
      ).toThrow('too weak');
    });
    it('accepts a long random secret in production', () => {
      const secret = 'k3Jx9vQ2mZpL7wTn4RcY8bHd5FsG1aUe6oNiVtXz';
      expect(validateEnv({ ...prod, JWT_SECRET: secret }).JWT_SECRET).toBe(secret);
    });
  });
});
