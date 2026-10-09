import 'reflect-metadata';
import { type ArgumentsHost, Body, Catch, Controller, type ExceptionFilter, Get, Headers, HttpCode, HttpException, Inject, Module, Param, Post } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {PrivateDatabaseSourceInvalidRequest,type PrivateDatabaseSources} from './private-database-source-store.js';
import {PrivateDatabaseRecordInvalidRequest,type PrivateDatabaseRecords} from './private-database-record-store.js';
import type {PrivateDatabaseRecordCatalog} from './private-database-record-catalog-store.js';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import type { FastifyReply } from 'fastify';
import { PrivateWorkspaceAccessDenied, type PrivateWorkspaceAccessStore } from '@greiva/application';
import { authenticatedPrivateAccess } from './authenticated-private-access.js';
import { SessionVerificationError, type SessionVerifier } from './session-verifier.js';
import { PrivateBootstrapInvalidRequest, PrivateBootstrapUnavailable, type PrivateWorkspaceBootstrap } from './private-bootstrap-store.js';
import { PrivateTransactionInvalidRequest, PrivateTransactionUnavailable, type PrivateDeviceAccess } from './private-transactions.js';
import { PrivateSyncInvalidRequest, type PrivateStructuredSync } from './private-structured-store.js';
import { PrivatePageInvalidRequest } from './private-page-codec.js';
import {PrivatePageCatalogInvalidRequest} from './private-page-catalog.js';
import {PrivatePageMetadataInvalidRequest,type PrivatePageMetadata} from './private-page-metadata-store.js';
import type { PrivatePageDocuments } from './private-page-store.js';
import type {PrivatePageChanges} from './private-page-changes-store.js';

const SESSION = Symbol('private-session'), ACCESS = Symbol('private-access');
const BOOTSTRAP = Symbol('private-bootstrap');
const DEVICE = Symbol('private-device');
const SYNC = Symbol('private-structured-sync');
const PAGE = Symbol('private-page-document'), METADATA=Symbol('private-page-metadata');
const CHANGES=Symbol('private-page-changes');
const SOURCES=Symbol('private-database-sources');
const RECORDS=Symbol('private-database-records');
const RECORD_CATALOG=Symbol('private-database-record-catalog');
@Controller('v1/workspaces/:workspaceId/databases/:sourceId/records')
class PrivateDatabaseRecordCatalogController{
 constructor(@Inject(SESSION) private readonly verifier:SessionVerifier,@Inject(RECORD_CATALOG) private readonly records:PrivateDatabaseRecordCatalog){}
 @Post('catalog') @HttpCode(200)
 async catalog(@Headers('authorization') authorization:unknown,@Param('workspaceId') workspaceId:string,@Param('sourceId') sourceId:string,@Body() body:unknown){return this.records.catalog(await this.verifier.verify(authorization),workspaceId,sourceId,body);}
}
@Controller('v1/workspaces/:workspaceId/databases/:sourceId/records')
class PrivateDatabaseRecordController{
 constructor(@Inject(SESSION) private readonly verifier:SessionVerifier,@Inject(RECORDS) private readonly records:PrivateDatabaseRecords){}
 @Post('write') @HttpCode(200)
 async write(@Headers('authorization') authorization:unknown,@Param('workspaceId') workspaceId:string,@Param('sourceId') sourceId:string,@Body() body:unknown){return this.records.write(await this.verifier.verify(authorization),workspaceId,sourceId,body);}
 @Post(':recordId/read') @HttpCode(200)
 async read(@Headers('authorization') authorization:unknown,@Param('workspaceId') workspaceId:string,@Param('sourceId') sourceId:string,@Param('recordId') recordId:string,@Body() body:unknown){return this.records.read(await this.verifier.verify(authorization),workspaceId,sourceId,recordId,body);}
}
@Controller('v1/workspaces/:workspaceId/databases')
class PrivateDatabaseSourceController{
 constructor(@Inject(SESSION) private readonly verifier:SessionVerifier,@Inject(SOURCES) private readonly sources:PrivateDatabaseSources){}
 @Post('create') @HttpCode(200)
 async create(@Headers('authorization') authorization:unknown,@Param('workspaceId') workspaceId:string,@Body() body:unknown){return this.sources.create(await this.verifier.verify(authorization),workspaceId,body);}
 @Post('catalog') @HttpCode(200)
 async catalog(@Headers('authorization') authorization:unknown,@Param('workspaceId') workspaceId:string,@Body() body:unknown){return this.sources.catalog(await this.verifier.verify(authorization),workspaceId,body);}
 @Post(':sourceId/read') @HttpCode(200)
 async read(@Headers('authorization') authorization:unknown,@Param('workspaceId') workspaceId:string,@Param('sourceId') sourceId:string,@Body() body:unknown){return this.sources.read(await this.verifier.verify(authorization),workspaceId,sourceId,body);}
}
@Controller('v1/workspaces/:workspaceId/pages/metadata')
class PrivatePageChangesController {
  constructor(@Inject(SESSION) private readonly verifier:SessionVerifier,@Inject(CHANGES) private readonly changes:PrivatePageChanges){}
  @Post('pull') @HttpCode(200)
  async pull(@Headers('authorization') authorization:unknown,@Param('workspaceId') workspaceId:string,@Body() body:unknown){return this.changes.pull(await this.verifier.verify(authorization),workspaceId,body);}
}
@Controller('v1/workspaces/:workspaceId/pages/:pageId/metadata')
class PrivatePageMetadataController {
  constructor(@Inject(SESSION) private readonly verifier:SessionVerifier,@Inject(METADATA) private readonly metadata:PrivatePageMetadata){}
  @Post('rename') @HttpCode(200)
  async rename(@Headers('authorization') authorization:unknown,@Param('workspaceId') workspaceId:string,@Param('pageId') pageId:string,@Body() body:unknown){return this.metadata.rename(await this.verifier.verify(authorization),workspaceId,pageId,body);}
  @Post('read') @HttpCode(200)
  async read(@Headers('authorization') authorization:unknown,@Param('workspaceId') workspaceId:string,@Param('pageId') pageId:string,@Body() body:unknown){return this.metadata.read(await this.verifier.verify(authorization),workspaceId,pageId,body);}
}
@Controller('v1/workspaces/:workspaceId/pages')
class PrivatePageCatalogController {
  constructor(@Inject(SESSION) private readonly verifier:SessionVerifier,@Inject(PAGE) private readonly page:PrivatePageDocuments){}
  @Post('query') @HttpCode(200)
  async query(@Headers('authorization') authorization:unknown,@Param('workspaceId') workspaceId:string,@Body() body:unknown){return this.page.query(await this.verifier.verify(authorization),workspaceId,body);}
}
@Controller('v1/workspaces/:workspaceId/pages/:pageId/document')
class PrivatePageController {
  constructor(@Inject(SESSION) private readonly verifier: SessionVerifier, @Inject(PAGE) private readonly page: PrivatePageDocuments) {}
  @Post('bootstrap') @HttpCode(200)
  async bootstrap(@Headers('authorization') authorization: unknown,@Param('workspaceId') workspaceId:string,@Param('pageId') pageId:string,@Body() body:unknown) {return this.page.bootstrap(await this.verifier.verify(authorization),workspaceId,pageId,body);}
  @Post('append') @HttpCode(200)
  async append(@Headers('authorization') authorization: unknown,@Param('workspaceId') workspaceId:string,@Param('pageId') pageId:string,@Body() body:unknown) {return this.page.append(await this.verifier.verify(authorization),workspaceId,pageId,body);}
  @Post('read') @HttpCode(200)
  async read(@Headers('authorization') authorization: unknown,@Param('workspaceId') workspaceId:string,@Param('pageId') pageId:string,@Body() body:unknown) {return this.page.read(await this.verifier.verify(authorization),workspaceId,pageId,body);}
}
@Controller('v1/workspaces')
class PrivateStructuredController {
  constructor(@Inject(SESSION) private readonly verifier: SessionVerifier, @Inject(SYNC) private readonly sync: PrivateStructuredSync) {}
  @Post(':workspaceId/sync/push') @HttpCode(200)
  async push(@Headers('authorization') authorization: unknown, @Param('workspaceId') workspaceId: string, @Body() body: unknown) {
    return this.sync.push(await this.verifier.verify(authorization),workspaceId,body);
  }
  @Post(':workspaceId/sync/pull') @HttpCode(200)
  async pull(@Headers('authorization') authorization: unknown, @Param('workspaceId') workspaceId: string, @Body() body: unknown) {
    return this.sync.pull(await this.verifier.verify(authorization),workspaceId,body);
  }
}
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
    if (error instanceof PrivatePageCatalogInvalidRequest) return response.status(400).send({error:error.code});
    if (error instanceof PrivatePageInvalidRequest) return response.status(['page_id_reused','unsupported_document_schema'].includes(error.code)?409:400).send({error:error.code});
    if(error instanceof PrivatePageMetadataInvalidRequest)return response.status(error.code==='operation_id_reused'?409:400).send({error:error.code});
    if(error instanceof PrivateDatabaseSourceInvalidRequest)return response.status(error.code==='invalid_request'?400:409).send({error:error.code});
    if(error instanceof PrivateDatabaseRecordInvalidRequest)return response.status(error.code==='invalid_request'?400:409).send({error:error.code});
    if (error instanceof PrivateSyncInvalidRequest) return response.status(error.code==='operation_id_reused'?409:400).send({ error: error.code });
    if (error instanceof PrivateTransactionInvalidRequest) return response.status(400).send({ error: 'invalid_request' });
    if (error instanceof PrivateTransactionUnavailable) return response.status(503).send({ error: 'transaction_unavailable' });
    if (error instanceof HttpException) return response.status(error.getStatus()).send({ error: error.getStatus() === 404 ? 'not_found' : 'invalid_request' });
    // Do not expose SQL, token/JWKS causes, private object IDs or request content.
    return response.status(503).send({ error: 'access_unavailable' });
  }
}
// Independent protected API factory. Does not mount or expose old PoC routes,
// listen automatically, create a test identity, or migrate a caller's database.
export async function createPrivateApp(verifier: SessionVerifier, store: PrivateWorkspaceAccessStore, bootstrap?: PrivateWorkspaceBootstrap, device?: PrivateDeviceAccess, sync?: PrivateStructuredSync, page?: PrivatePageDocuments, metadata?:PrivatePageMetadata, changes?:PrivatePageChanges,sources?:PrivateDatabaseSources,records?:PrivateDatabaseRecords,recordCatalog?:PrivateDatabaseRecordCatalog) {
  @Module({ controllers: [PrivateAccessController, ...(recordCatalog?[PrivateDatabaseRecordCatalogController]:[]), ...(records?[PrivateDatabaseRecordController]:[]), ...(sources?[PrivateDatabaseSourceController]:[]), ...(changes?[PrivatePageChangesController]:[]), ...(metadata?[PrivatePageMetadataController]:[]), ...(bootstrap ? [PrivateBootstrapController] : []), ...(device ? [PrivateDeviceController] : []), ...(sync ? [PrivateStructuredController] : []), ...(page ? [PrivatePageController,PrivatePageCatalogController] : [])], providers: [
    { provide: SESSION, useValue: verifier }, { provide: ACCESS, useValue: authenticatedPrivateAccess(verifier, store) },
    ...(bootstrap ? [{ provide: BOOTSTRAP, useValue: bootstrap }] : []),
    ...(device ? [{ provide: DEVICE, useValue: device }] : []),
    ...(sync ? [{ provide: SYNC, useValue: sync }] : []),
    ...(metadata ? [{provide:METADATA,useValue:metadata}] : []),
    ...(changes?[{provide:CHANGES,useValue:changes}]:[]),
    ...(sources?[{provide:SOURCES,useValue:sources}]:[]),
    ...(records?[{provide:RECORDS,useValue:records}]:[]),
    ...(recordCatalog?[{provide:RECORD_CATALOG,useValue:recordCatalog}]:[]),
    ...(page ? [{ provide: PAGE, useValue: page }] : []),
  ] })
  class PrivateAppModule {}
  const app = await NestFactory.create<NestFastifyApplication>(PrivateAppModule, new FastifyAdapter({ logger: false }), { logger: false });
  app.useGlobalFilters(new PrivateAccessErrors());
  await app.init(); await app.getHttpAdapter().getInstance().ready();
  return app;
}
