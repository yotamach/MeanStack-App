import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly db: Connection) {}

  /** Liveness + readiness in one: 200 only while MongoDB is connected. Used by Docker healthchecks. */
  @Get()
  async check() {
    try {
      await this.db.db?.admin().ping();
      return { status: 'ok', db: 'up' };
    } catch {
      throw new ServiceUnavailableException('Database unavailable');
    }
  }
}
