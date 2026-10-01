import 'reflect-metadata';
import { Controller, Get, Inject, Module, ServiceUnavailableException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { StructuredRepository } from './structured-repository.js';
const STORAGE = Symbol('structured-storage');
@Controller()
class HealthController {
  @Get('health') health() { return { service: 'api', status: 'ok', implementationStep: 6 }; }
}
@Controller()
class StructuredController {
  constructor(@Inject(STORAGE) private readonly repository: StructuredRepository | null) {}
  @Get('tasks') tasks() { return this.available().tasks(); }
  @Get('relations') relations() { return this.available().relations(); }
  private available() {
    if (!this.repository) throw new ServiceUnavailableException('Structured storage is not configured');
    return this.repository;
  }
}
export async function createApp(options: { databaseUrl?: string | null; schemaName?: string } = {}) {
  const databaseUrl = options.databaseUrl === undefined ? process.env.DATABASE_URL : options.databaseUrl;
  const repository = databaseUrl ? await StructuredRepository.open(databaseUrl, options.schemaName) : null;
  @Module({ controllers: [HealthController, StructuredController], providers: [{ provide: STORAGE, useValue: repository }] })
  class AppModule {}
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), { logger: false });
  app.enableShutdownHooks();
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}
