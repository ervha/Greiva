import 'reflect-metadata';
import { BadRequestException, Body, Controller, Get, HttpCode, Inject, Module, Post, ServiceUnavailableException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { InvalidCursorError, StructuredRepository } from './structured-repository.js';
import { pullRequestSchema, pushRequestSchema, pushResponseSchema } from '@greiva/protocol';
const STORAGE = Symbol('structured-storage');
@Controller()
class HealthController {
  @Get('health') health() { return { service: 'api', status: 'ok', implementationStep: 7 }; }
}
@Controller()
class StructuredController {
  constructor(@Inject(STORAGE) private readonly repository: StructuredRepository | null) {}
  @Get('tasks') tasks() { return this.available().tasks(); }
  @Get('relations') relations() { return this.available().relations(); }
  @Post('sync/push') @HttpCode(200) async push(@Body() body: unknown) {
    const input = pushRequestSchema.safeParse(body);
    if (!input.success) throw new BadRequestException('Invalid push envelope');
    const repository = this.available(); const results = [];
    for (const operation of input.data.operations) {
      const result = await repository.push(operation); results.push(result);
      console.info(JSON.stringify({service:'api',event:'structured-push',operationId:operation.operationId,clientId:operation.clientId,
        serverOrder:result.serverOrder,status:result.status,conflicts:result.conflicts.length}));
    }
    return pushResponseSchema.parse({results});
  }
  @Post('sync/pull') @HttpCode(200) async pull(@Body() body: unknown) {
    const input = pullRequestSchema.safeParse(body);
    if (!input.success) throw new BadRequestException('Invalid pull envelope');
    try { return await this.available().pull(input.data.cursor,input.data.limit); }
    catch (error) { if (error instanceof InvalidCursorError) throw new BadRequestException(error.message); throw error; }
  }
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
  app.enableCors({origin:['http://127.0.0.1:1420','http://localhost:1420','http://tauri.localhost','tauri://localhost'],methods:['GET','POST'],allowedHeaders:['Content-Type']});
  app.enableShutdownHooks();
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}
