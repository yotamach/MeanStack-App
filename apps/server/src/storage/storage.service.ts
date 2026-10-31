import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import * as path from 'path';
import { Env } from '../config/env';

export const IMAGES_URL_PREFIX = '/images/';

/** Where uploaded images live. Swap this class for S3/Cloudinary without touching the posts code. */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  readonly dir: string;

  constructor(config: ConfigService<Env, true>) {
    this.dir = path.resolve(config.get('UPLOAD_DIR', { infer: true }));
  }

  /** Stores the image and returns its public path (`/images/<file>`), which is what gets saved on the post. */
  async save(buffer: Buffer, baseName: string, ext: string): Promise<string> {
    const safe =
      baseName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'image';
    const fileName = `${safe}-${Date.now()}.${ext}`;
    await fs.mkdir(this.dir, { recursive: true });
    await fs.writeFile(path.join(this.dir, fileName), buffer);
    return IMAGES_URL_PREFIX + fileName;
  }

  /**
   * Deletes the file behind a stored image path. Accepts the current relative form and the absolute
   * URLs written by older versions. Never throws: a leftover file is better than a failed request.
   */
  async remove(imagePath: string): Promise<void> {
    const fileName = this.fileNameOf(imagePath);
    if (!fileName) {
      return;
    }
    try {
      await fs.unlink(path.join(this.dir, fileName));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn(`Could not delete image ${fileName}: ${(err as Error).message}`);
      }
    }
  }

  /** The bare file name of one of our images, or null for anything else (other hosts' paths, traversal attempts). */
  private fileNameOf(imagePath: string): string | null {
    let pathname: string;
    try {
      pathname = decodeURIComponent(new URL(imagePath, 'http://placeholder').pathname);
    } catch {
      return null;
    }
    if (!pathname.startsWith(IMAGES_URL_PREFIX)) {
      return null;
    }
    const fileName = pathname.slice(IMAGES_URL_PREFIX.length);
    return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(fileName) && !fileName.includes('..')
      ? fileName
      : null;
  }
}
