import { privateRuntimeConfiguration, PrivateRuntimeError, startPrivateApi } from './private-runtime.js';

try {
  const runtime = await startPrivateApi(privateRuntimeConfiguration(process.env));
  console.log(JSON.stringify({ service: 'private-api', event: 'listening', address: runtime.address }));
  const stop = () => { void runtime.close().catch(() => {
    console.error(JSON.stringify({ service: 'private-api', event: 'failed', stage: 'shutdown' })); process.exitCode = 1;
  }); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
} catch (error) {
  console.error(JSON.stringify({ service: 'private-api', event: 'failed', stage: error instanceof PrivateRuntimeError ? error.stage : 'startup' }));
  process.exitCode = 1;
}
