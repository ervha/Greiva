import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
const json = file => JSON.parse(readFileSync(file, 'utf8'));
const digest = file => createHash('sha256').update(readFileSync(file)).digest('hex');
export function versions() {
  const manifests = ['package.json', ...['apps', 'packages'].flatMap(dir => readdirSync(dir).map(name => `${dir}/${name}/package.json`))];
  return {
    runtime: { node: process.version, npm: json('package.json').packageManager, rust: '1.98.1', postgres: '18.4-bookworm' },
    directDependencies: Object.fromEntries(manifests.map(file => {
      const manifest = json(file);
      return [manifest.name, { ...manifest.dependencies, ...manifest.devDependencies }];
    })),
    rust: { tauri: '2.12.0', 'tauri-build': '2.7.0', 'tauri-plugin-sql': '2.5.0' },
    hashes: { npmLock: digest('package-lock.json'), cargoLock: digest('apps/client/src-tauri/Cargo.lock'), spec: digest('docs/plan/POC_SPEC.md') },
  };
}
if (process.argv[1]?.endsWith('versions.mjs')) console.log(JSON.stringify(versions(), null, 2));
