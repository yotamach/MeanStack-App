import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import * as path from 'path';
import { Env } from '../config/env';

/** Where uploaded images live. Swap this class for S3/Cloudinary without touching the posts code. */
@Injectable()
export class StorageService {
  readonly dir: string;

  constructor(config: ConfigService<Env, true>) {
    this.dir = path.resolve(config.get('UPLOAD_DIR', { infer: true }));
  }

  /** Stores the image and returns the file name it was saved under. */
  async save(buffer: Buffer, baseName: string, ext: string): Promise<string> {
    const safe = baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'image';
    const fileName = `${safe}-${Date.now()}.${ext}`;
    await fs.mkdir(this.dir, { recursive: true });
    await fs.writeFile(path.join(this.dir, fileName), buffer);
    return fileName;
  }
}
