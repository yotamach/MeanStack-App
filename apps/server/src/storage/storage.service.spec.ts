import { ConfigService } from '@nestjs/config';
import { existsSync, mkdtempSync, readdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { basename, join } from 'path';
import { StorageService } from './storage.service';

describe('StorageService', () => {
  let dir: string;
  let outside: string;
  let storage: StorageService;

  beforeEach(() => {
    const root = mkdtempSync(join(tmpdir(), 'storage-spec-'));
    dir = join(root, 'uploads');
    outside = join(root, 'secret.txt');
    writeFileSync(outside, 'do not delete');
    storage = new StorageService({ get: () => dir } as unknown as ConfigService<never, true>);
  });

  it('saves a file and returns its public path', async () => {
    const path = await storage.save(Buffer.from('x'), 'My Photo!', 'png');
    expect(path).toMatch(/^\/images\/my-photo-\d+\.png$/);
    expect(existsSync(join(dir, basename(path)))).toBe(true);
  });

  it('removes a file by relative path', async () => {
    const path = await storage.save(Buffer.from('x'), 'a', 'png');
    await storage.remove(path);
    expect(readdirSync(dir)).toHaveLength(0);
  });

  it('removes a file by the absolute URL older versions stored', async () => {
    const path = await storage.save(Buffer.from('x'), 'a', 'png');
    await storage.remove(`http://localhost:3000${path}`);
    expect(readdirSync(dir)).toHaveLength(0);
  });

  it('ignores a missing file without throwing', async () => {
    await expect(storage.remove('/images/nope-1.png')).resolves.toBeUndefined();
  });

  it.each([
    ['parent traversal', '/images/../secret.txt'],
    ['encoded traversal', '/images/..%2Fsecret.txt'],
    ['nested path', '/images/sub/secret.txt'],
    ['another prefix', '/other/secret.txt'],
    ['a foreign absolute path', 'https://evil.example/etc/passwd'],
    ['an empty name', '/images/'],
    ['garbage', 'http://['],
  ])('never deletes outside the uploads folder (%s)', async (_name, input) => {
    await storage.save(Buffer.from('keep'), 'keep', 'png');
    await storage.remove(input);
    expect(existsSync(outside)).toBe(true);
    expect(readdirSync(dir)).toHaveLength(1);
  });
});
