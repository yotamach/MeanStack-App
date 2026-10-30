export interface Env {
  PORT: number;
  MONGODB_URI: string;
  JWT_SECRET: string;
  CLIENT_ORIGIN: string;
  UPLOAD_DIR: string;
}

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
  return {
    PORT: port,
    MONGODB_URI: required('MONGODB_URI'),
    JWT_SECRET: required('JWT_SECRET'),
    CLIENT_ORIGIN: (raw.CLIENT_ORIGIN as string) || 'http://localhost:4200',
    UPLOAD_DIR: (raw.UPLOAD_DIR as string) || 'uploads'
  };
};
