import { AsyncValidatorFn } from '@angular/forms';

/** Reads the file's magic bytes; the browser-reported type is trivially spoofed. */
export const isPngOrJpeg = (bytes: Uint8Array): boolean => {
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b);
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return png || jpeg;
};

/** Validates freshly picked files; an existing image URL (string) is always valid. */
export const mimeType: AsyncValidatorFn = async (control) => {
  const value: unknown = control.value;
  if (!(value instanceof Blob)) {
    return null;
  }
  const bytes = new Uint8Array(await value.slice(0, 8).arrayBuffer());
  return isPngOrJpeg(bytes) ? null : { invalidMimeType: true };
};
