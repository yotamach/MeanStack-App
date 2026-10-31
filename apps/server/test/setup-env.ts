import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// A throwaway database per test process and a throwaway upload dir, so tests never touch real data.
const uri = new URL(process.env.TEST_MONGODB_URI ?? 'mongodb://localhost:27017');
uri.pathname = `/meanstack_test_${process.pid}_${Date.now()}`;

process.env.MONGODB_URI = uri.toString();
process.env.JWT_SECRET = 'test-secret';
process.env.LOG_LEVEL = 'silent';
process.env.TRUST_PROXY = '1';
process.env.CLIENT_ORIGIN = 'http://localhost:4200';
process.env.UPLOAD_DIR = mkdtempSync(join(tmpdir(), 'meanstack-uploads-'));
