import { detectImageExt } from './image-type';

describe('detectImageExt', () => {
  it('detects PNG', () => {
    expect(detectImageExt(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe('png');
  });
  it('detects JPEG', () => {
    expect(detectImageExt(Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0]))).toBe('jpg');
  });
  it.each([
    ['GIF', Buffer.from('GIF89a')],
    ['text', Buffer.from('hello world')],
    ['empty', Buffer.alloc(0)],
    ['a truncated PNG header', Buffer.from([0x89, 0x50, 0x4e, 0x47])],
  ])('rejects %s', (_n, buf) => {
    expect(detectImageExt(buf)).toBeNull();
  });
});
