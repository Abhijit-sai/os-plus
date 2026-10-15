// Local repository metadata/files only; no network, credentials or release actions.
// --print emits a proposed manifest to stdout; no files are written by this tool.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, lstatSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const git = (...args) => execFileSync('git', ['-c', 'core.safecrlf=false', ...args], {
  cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 4_000_000,
}).trim();
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const base = '5882974bc102eb417d14adbc055f7d2f8de315ca';
const roots = ['.env.example', '.gitignore', 'components.json', 'eslint.config.mjs',
  'next.config.ts', 'next-env.d.ts', 'package.json', 'package-lock.json',
  'postcss.config.mjs', 'tailwind.config.ts', 'tsconfig.json', 'vercel.json', '.vercelignore', '.npmrc'];
const paths = ['src', 'public', 'scripts', 'supabase/migrations', ...roots];
const cleanupPath = 'docs/sql/20261015170000_shopify_trigger_permission_cleanup.proposed.sql';
const manifestPath = resolve(root, 'docs/shopify-release-preparation.json');
function describe(path) {
  assert.ok(!path.includes('..') && !path.includes('\\') && !path.startsWith('/'));
  assert.ok(!/(?:^|\/)(?:node_modules|\.next|\.env\.local|\.vercel)(?:\/|$)/.test(path));
  const absolute = resolve(root, path);
  assert.ok(lstatSync(absolute).isFile() && !lstatSync(absolute).isSymbolicLink(), `Not a regular source file: ${path}`);
  const bytes = readFileSync(absolute);
  return { path, bytes: bytes.length, sha256: sha(bytes) };
}
function current() {
  assert.equal(git('rev-parse', 'HEAD'), base, 'Base changed; renew the release review');
  assert.equal(git('branch', '--show-current'), 'codex/shopify-intake-foundation-20261008');
  const split = s => s.split('\0').filter(Boolean);
  const modified = split(git('diff', '--name-only', '-z', base, '--', ...paths));
  const added = split(git('ls-files', '--others', '--exclude-standard', '-z', '--', ...paths));
  const overlay = [...new Set([...modified, ...added])].sort().map(describe);
  const preparationFiles = [cleanupPath, cleanupPath.replace('.proposed.sql', '.verify.sql'),
    'docs/38_Shopify_Permission_Cleanup_and_Deployment_Approval.md'].map(describe);
  const evidence = describe('docs/shopify-schema-check-8c7ef868af7ce1217c85fc2d1f59e3ab.json');
  // Evidence validators and offline harnesses consume these nonsecret fixtures.
  // Include their complete repository dependency set, not just the latest proof.
  const evidenceFiles = readdirSync(resolve(root, 'docs')).filter(name =>
    /^shopify-(?:private-rehearsal|fresh-recovery|readonly-preflight|schema-check|ownership-check)-[a-zA-Z0-9]+\.json$/.test(name))
    .sort().map(name => describe('docs/' + name));
  return {
    kind: 'osplus-shopify-release-preparation-v1', status: 'PREPARATION_ONLY_NOT_APPROVED',
    mayApply: false, mayCommit: false, mayPush: false, mayMerge: false, mayDeploy: false, mayActivate: false,
    reviewBaseline: 'c701ec3', baseCommit: base, branch: 'codex/shopify-intake-foundation-20261008',
    applicationCommit: null, deploymentId: null,
    projectRef: 'dxiyihrdfismbuqdmhit', tenantId: '7be40f50-94a0-46c5-af57-7eea5e36ea8a',
    tenantName: 'Phantom Threads Test', shopDomain: 'n1djr1-99.myshopify.com',
    origin: 'https://os-plus.vercel.app', apiVersion: '2026-10', preserveFunctionRegion: 'Seoul',
    sourceDefinition: 'Base commit plus exact overlay, preparationFiles, evidenceFiles, appliedTwelveFileManifest and this manifest. Not a built artifact or execution approval. Unchanged base files inherited; other narrative/progress docs excluded.',
    scopePathspecs: paths, overlay, overlaySha256: sha(JSON.stringify(overlay)), preparationFiles, evidenceFiles,
    verificationEvidence: evidence,
    appliedTwelveFileManifest: describe('docs/shopify-hosted-test-package.json'),
    cleanupIsAutomaticMigration: false,
    disabledFlags: ['SHOPIFY_SYNC_ENABLED', 'SHOPIFY_INTAKE_ENABLED', 'SHOPIFY_HYDRATION_ENABLED',
      'SHOPIFY_DRAFT_IMPORT_ENABLED', 'SHOPIFY_PRIVACY_ENABLED', 'SHOPIFY_EXECUTOR_ENABLED',
      'SHOPIFY_PILOT_CREDENTIALS_ENABLED', 'SHOPIFY_PILOT_OPERATIONS_ENABLED',
      'SHOPIFY_TEST_COPY_ENABLED', 'SHOPIFY_RELEASE_ENABLED', 'SHOPIFY_UNINSTALL_ENABLED',
      'SHOPIFY_SCHEDULED_WORKER_ENABLED', 'SHOPIFY_CONNECTION_SCREEN_ENABLED', 'SHOPIFY_CONNECTION_TEST_ENABLED'],
  };
}
const args = process.argv.slice(2);
assert.ok(args.length === 0 || (args.length === 1 && args[0] === '--print'));
const actual = current();
if (args[0] === '--print') console.log(JSON.stringify(actual, null, 2));
else {
  const expected = JSON.parse(readFileSync(manifestPath, 'utf8'));
  assert.deepEqual(actual, expected, 'Source/package drift: renew review; do not deploy');
  console.log(`PASS preparation-only release inventory: ${actual.overlay.length} overlay files; exact cleanup/docs/evidence hashes; all execution gates false`);
}
