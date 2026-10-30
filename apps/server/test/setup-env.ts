import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// A throwaway database per test file process and a throwaway upload dir, so tests never touch real data.
const base = process.env.TEST_MONGODB_URI ?? 'mongodb://localhost:27017';
const dbName = `meanstack_test_${process.pid}_${Date.now()}`;

process.env.MONGODB_URI = `${base.replace(/\/[^/]*$/, '').replace(/\/$/, '')}/${dbName}`.replace(
  /^(mongodb(\+srv)?:\/)([^/])/,
  '$1/$3',
);
process.env.JWT_SECRET = 'test-secret';
process.env.CLIENT_ORIGIN = 'http://localhost:4200';
process.env.UPLOAD_DIR = mkdtempSync(join(tmpdir(), 'meanstack-uploads-'));
