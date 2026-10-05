import 'reflect-metadata';
import { type ArgumentsHost, Body, Catch, Controller, type ExceptionFilter, Get, Headers, HttpCode, HttpException, Inject, Module, Param, Post } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import type { FastifyReply } from 'fastify';
import { PrivateWorkspaceAccessDenied, type PrivateWorkspaceAccessStore } from '@greiva/application';
import { authenticatedPrivateAccess } from './authenticated-private-access.js';
import { SessionVerificationError, type SessionVerifier } from './session-verifier.js';
import { PrivateBootstrapInvalidRequest, PrivateBootstrapUnavailable, type PrivateWorkspaceBootstrap } from './private-bootstrap-store.js';
import { PrivateTransactionInvalidRequest, PrivateTransactionUnavailable, type PrivateDeviceAccess } from './private-transactions.js';

const SESSION = Symbol('private-session'), ACCESS = Symbol('private-access');
const BOOTSTRAP = Symbol('private-bootstrap');
const DEVICE = Symbol('private-device');
@Controller('v1/workspaces')
class PrivateDeviceController {
  constructor(@Inject(SESSION) private readonly verifier: SessionVerifier, @Inject(DEVICE) private readonly device: PrivateDeviceAccess) {}
  @Get(':workspaceId/devices/:clientId/access')
  async access(@Headers('authorization') authorization: unknown, @Param('workspaceId') workspaceId: string, @Param('clientId') clientId: string) {
    return this.device.access(await this.verifier.verify(authorization), workspaceId, clientId);
  }
}
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
@Controller('v1/workspaces')
class PrivateBootstrapController {
  constructor(@Inject(SESSION) private readonly verifier: SessionVerifier, @Inject(BOOTSTRAP) private readonly bootstrap: PrivateWorkspaceBootstrap) {}
  @Post('bootstrap') @HttpCode(200)
  async create(@Headers('authorization') authorization: unknown, @Body() body: unknown) {
    const session = await this.verifier.verify(authorization);
    return this.bootstrap.bootstrap(session, body);
  }
}
@Catch()
class PrivateAccessErrors implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<FastifyReply>();
    if (error instanceof SessionVerificationError) return response.status(error.code === 'invalid_session' ? 401 : 503).send({ error: error.code });
    if (error instanceof PrivateWorkspaceAccessDenied) return response.status(403).send({ error: 'access_denied' });
    if (error instanceof PrivateBootstrapInvalidRequest) return response.status(400).send({ error: 'invalid_request' });
    if (error instanceof PrivateBootstrapUnavailable) return response.status(503).send({ error: 'bootstrap_unavailable' });
    if (error instanceof PrivateTransactionInvalidRequest) return response.status(400).send({ error: 'invalid_request' });
    if (error instanceof PrivateTransactionUnavailable) return response.status(503).send({ error: 'transaction_unavailable' });
    if (error instanceof HttpException) return response.status(error.getStatus()).send({ error: error.getStatus() === 404 ? 'not_found' : 'invalid_request' });
    // Do not expose SQL, token/JWKS causes, private object IDs or request content.
    return response.status(503).send({ error: 'access_unavailable' });
  }
}
// Independent protected API factory. Does not mount or expose old PoC routes,
// listen automatically, create a test identity, or migrate a caller's database.
export async function createPrivateApp(verifier: SessionVerifier, store: PrivateWorkspaceAccessStore, bootstrap?: PrivateWorkspaceBootstrap, device?: PrivateDeviceAccess) {
  @Module({ controllers: [PrivateAccessController, ...(bootstrap ? [PrivateBootstrapController] : []), ...(device ? [PrivateDeviceController] : [])], providers: [
    { provide: SESSION, useValue: verifier }, { provide: ACCESS, useValue: authenticatedPrivateAccess(verifier, store) },
    ...(bootstrap ? [{ provide: BOOTSTRAP, useValue: bootstrap }] : []),
    ...(device ? [{ provide: DEVICE, useValue: device }] : []),
  ] })
  class PrivateAppModule {}
  const app = await NestFactory.create<NestFastifyApplication>(PrivateAppModule, new FastifyAdapter({ logger: false }), { logger: false });
  app.useGlobalFilters(new PrivateAccessErrors());
  await app.init(); await app.getHttpAdapter().getInstance().ready();
  return app;
}
