import { FormControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { mimeType } from './mime-type.validator';

const validate = (value: unknown) => mimeType(new FormControl(value));
const file = (bytes: number[]) => new File([new Uint8Array(bytes)], 'x.png', { type: 'image/png' });

describe('mimeType validator', () => {
  it('accepts an existing image URL', async () => {
    expect(await validate('http://localhost/images/a.png')).toBeNull();
  });

  it('accepts PNG and JPEG by magic bytes', async () => {
    expect(await validate(file([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBeNull();
    expect(await validate(file([0xff, 0xd8, 0xff, 0xe0, 0]))).toBeNull();
  });

  it('rejects other content even if it claims to be a png', async () => {
    expect(await validate(file([0x47, 0x49, 0x46, 0x38]))).toEqual({ invalidMimeType: true });
  });
});
