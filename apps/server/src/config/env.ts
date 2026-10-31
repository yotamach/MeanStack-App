export interface Env {
  PORT: number;
  MONGODB_URI: string;
  JWT_SECRET: string;
  CLIENT_ORIGIN: string;
  UPLOAD_DIR: string;
  LOG_LEVEL: string;
  /** Number of reverse proxies in front of the API (0 = none); drives client IP and protocol detection. */
  TRUST_PROXY: number;
  /** How long a refresh token (and so a login session) stays valid without being used. */
  REFRESH_TOKEN_TTL_DAYS: number;
}

const MIN_PRODUCTION_SECRET_LENGTH = 32;

export const validateEnv = (raw: Record<string, unknown>): Env => {
  const required = (name: string): string => {
    const value = raw[name];
    if (typeof value !== 'string' || value.length === 0) {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
  };
  const port = Number(raw.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 0) {
    throw new Error('PORT must be a non-negative integer');
  }
  const trustProxy = Number(raw.TRUST_PROXY ?? 0);
  if (!Number.isInteger(trustProxy) || trustProxy < 0) {
    throw new Error('TRUST_PROXY must be a non-negative integer');
  }
  const jwtSecret = required('JWT_SECRET');
  if (
    raw.NODE_ENV === 'production' &&
    (jwtSecret.length < MIN_PRODUCTION_SECRET_LENGTH || /^change-?me/i.test(jwtSecret))
  ) {
    throw new Error(
      `JWT_SECRET is too weak for production: use at least ${MIN_PRODUCTION_SECRET_LENGTH} random characters ` +
        '(e.g. `openssl rand -base64 48`), not the .env.example placeholder',
    );
  }
  const refreshDays = Number(raw.REFRESH_TOKEN_TTL_DAYS ?? 7);
  if (!Number.isFinite(refreshDays) || refreshDays <= 0) {
    throw new Error('REFRESH_TOKEN_TTL_DAYS must be a positive number');
  }
  return {
    PORT: port,
    MONGODB_URI: required('MONGODB_URI'),
    JWT_SECRET: jwtSecret,
    CLIENT_ORIGIN: (raw.CLIENT_ORIGIN as string) || 'http://localhost:4200',
    UPLOAD_DIR: (raw.UPLOAD_DIR as string) || 'uploads',
    LOG_LEVEL: (raw.LOG_LEVEL as string) || 'info',
    TRUST_PROXY: trustProxy,
    REFRESH_TOKEN_TTL_DAYS: refreshDays,
  };
};
