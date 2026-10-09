import type {PrivateDatabaseViewCatalog} from './private-database-view-catalog-store.js';
import type {PrivateDatabaseViews} from './private-database-view-store.js';
import { supabaseConfiguration } from '@greiva/shared';
import type { PrivateWorkspaceAccessStore } from '@greiva/application';
import type { PrivateWorkspaceBootstrap } from './private-bootstrap-store.js';
import { sessionVerifier } from './session-verifier.js';
import { createPrivateApp } from './private-app.js';
import type { PrivateDeviceAccess } from './private-transactions.js';
import type { PrivateStructuredSync } from './private-structured-store.js';
import type {PrivatePageMetadata} from './private-page-metadata-store.js';
import type {PrivatePageChanges} from './private-page-changes-store.js';
import type { PrivatePageDocuments } from './private-page-store.js';
import type {PrivateDatabaseSources} from './private-database-source-store.js';
import type {PrivateDatabaseRecords} from './private-database-record-store.js';
import type {PrivateDatabaseRecordCatalog} from './private-database-record-catalog-store.js';

// Explicit composition root; does not listen, migrate, select a default project,
// read a token from env, or expose ordinary PoC routes.
export function createSupabasePrivateApp(configuration: Readonly<{ projectUrl: string; algorithm: 'ES256' | 'RS256' }>, store: PrivateWorkspaceAccessStore, bootstrap?: PrivateWorkspaceBootstrap, fetchJwks?: typeof fetch, device?: PrivateDeviceAccess, sync?: PrivateStructuredSync, page?: PrivatePageDocuments, metadata?:PrivatePageMetadata, changes?:PrivatePageChanges,sources?:PrivateDatabaseSources,records?:PrivateDatabaseRecords,recordCatalog?:PrivateDatabaseRecordCatalog,views?:PrivateDatabaseViews,viewCatalog?:PrivateDatabaseViewCatalog) {
  return createPrivateApp(sessionVerifier(supabaseConfiguration(configuration.projectUrl, configuration.algorithm), fetchJwks), store, bootstrap, device, sync, page, metadata,changes,sources,records,recordCatalog,views,viewCatalog);
}
