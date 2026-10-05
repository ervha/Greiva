import 'reflect-metadata';
import { type ArgumentsHost, Catch, Controller, type ExceptionFilter, Get, Headers, HttpException, Inject, Module, Param } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import type { FastifyReply } from 'fastify';
import { PrivateWorkspaceAccessDenied, type PrivateWorkspaceAccessStore } from '@greiva/application';
import { authenticatedPrivateAccess } from './authenticated-private-access.js';
import { SessionVerificationError, type SessionVerifier } from './session-verifier.js';

const SESSION = Symbol('private-session'), ACCESS = Symbol('private-access');
@Controller('v1')
class PrivateAccessController {
  constructor(@Inject(SESSION) private readonly verifier: SessionVerifier, @Inject(ACCESS) private readonly access: ReturnType<typeof authenticatedPrivateAccess>) {}
  @Get('session') session(@Headers('authorization') authorization: unknown) { return this.verifier.verify(authorization); }
  @Get('workspaces/:workspaceId/access') workspace(@Headers('authorization') authorization: unknown, @Param('workspaceId') workspaceId: string) {
    return this.access.workspace(authorization, workspaceId);
  }
  @Get('workspaces/:workspaceId/pages/:pageId/access') page(@Headers('authorization') authorization: unknown, @Param('workspaceId') workspaceId: string, @Param('pageId') pageId: string) {
    return this.access.pageDocument(authorization, workspaceId, `page:${pageId}`);
  }
}
@Catch()
class PrivateAccessErrors implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<FastifyReply>();
    if (error instanceof SessionVerificationError) return response.status(error.code === 'invalid_session' ? 401 : 503).send({ error: error.code });
    if (error instanceof PrivateWorkspaceAccessDenied) return response.status(403).send({ error: 'access_denied' });
    if (error instanceof HttpException) return response.status(error.getStatus()).send({ error: error.getStatus() === 404 ? 'not_found' : 'invalid_request' });
    // Do not expose SQL, token/JWKS causes, private object IDs or request content.
    return response.status(503).send({ error: 'access_unavailable' });
  }
}
// Independent protected API factory. Does not mount or expose old PoC routes,
// listen automatically, create a test identity, or migrate a caller's database.
export async function createPrivateApp(verifier: SessionVerifier, store: PrivateWorkspaceAccessStore) {
  @Module({ controllers: [PrivateAccessController], providers: [
    { provide: SESSION, useValue: verifier }, { provide: ACCESS, useValue: authenticatedPrivateAccess(verifier, store) },
  ] })
  class PrivateAppModule {}
  const app = await NestFactory.create<NestFastifyApplication>(PrivateAppModule, new FastifyAdapter({ logger: false }), { logger: false });
  app.useGlobalFilters(new PrivateAccessErrors());
  await app.init(); await app.getHttpAdapter().getInstance().ready();
  return app;
}
