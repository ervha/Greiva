import { supabaseConfiguration } from '@greiva/shared';
import type { PrivateWorkspaceAccessStore } from '@greiva/application';
import type { PrivateWorkspaceBootstrap } from './private-bootstrap-store.js';
import { sessionVerifier } from './session-verifier.js';
import { createPrivateApp } from './private-app.js';

// Explicit composition root; does not listen, migrate, select a default project,
// read a token from env, or expose ordinary PoC routes.
export function createSupabasePrivateApp(configuration: Readonly<{ projectUrl: string; algorithm: 'ES256' | 'RS256' }>, store: PrivateWorkspaceAccessStore, bootstrap?: PrivateWorkspaceBootstrap, fetchJwks?: typeof fetch) {
  return createPrivateApp(sessionVerifier(supabaseConfiguration(configuration.projectUrl, configuration.algorithm), fetchJwks), store, bootstrap);
}
