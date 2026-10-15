// Repository fixtures only. No network, Git mutation, credentials or deployment.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = new URL('../../', import.meta.url);
const read = path => readFileSync(new URL(path, root));
const proposal = JSON.parse(read('docs/shopify-release-preparation.json'));
const historical = JSON.parse(read('docs/shopify-hosted-test-package.json'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function assertClosure(manifest) {
  const files = [...manifest.overlay, ...manifest.preparationFiles, ...manifest.evidenceFiles, manifest.appliedTwelveFileManifest];
  const paths = new Set(files.map(f => f.path));
  assert.equal(paths.size, files.length, 'Duplicate allowlist entries');
  const required = new Set([
    'docs/sql/20261015170000_shopify_trigger_permission_cleanup.proposed.sql',
    'docs/sql/20261015170000_shopify_trigger_permission_cleanup.verify.sql',
    'docs/shopify-ownership-check-41d468410f65cd0f95f464fdc11cba7c.json',
    'docs/shopify-private-rehearsal-dfe2ea34822a86007cffb0eda59fd181.json',
  ]);
  function referenced(value) {
    if (!value || typeof value !== 'object') return;
    for (const child of Object.values(value)) {
      if (typeof child === 'string' && /^shopify-[\w-]+\.json$/.test(child)) required.add('docs/' + child);
      else referenced(child);
    }
  }
  referenced(historical);
  for (const path of required) assert.ok(paths.has(path), `Missing repository evidence dependency: ${path}`);
}
test('release allowlist includes the evidence dependency closure and immutable SQL baseline', () => {
  assertClosure(proposal);
  for (const entry of historical.migrations) {
    assert.ok(proposal.overlay.some(f => f.path === 'supabase/migrations/' + entry.file && f.sha256 === entry.sha256));
  }
});
test('every recorded source/proposal/evidence byte hash matches, all gates stay false', () => {
  for (const key of ['mayApply','mayCommit','mayPush','mayMerge','mayDeploy','mayActivate']) assert.equal(proposal[key], false);
  assert.equal(proposal.applicationCommit, null); assert.equal(proposal.deploymentId, null);
  for (const f of [...proposal.overlay, ...proposal.preparationFiles, ...proposal.evidenceFiles, proposal.appliedTwelveFileManifest]) {
    const bytes = read(f.path); assert.equal(bytes.length, f.bytes, f.path); assert.equal(sha(bytes), f.sha256, f.path);
    assert.ok(!/(?:^|\/)(?:node_modules|\.next|\.vercel|\.env\.local)(?:\/|$)/.test(f.path));
  }
  assert.equal(sha(JSON.stringify(proposal.overlay)), proposal.overlaySha256);
});
test('omitting each required evidence fixture is rejected before release', () => {
  for (const path of [
    historical.localBlockerRepairEvidenceFile, historical.finalPackagePrivateRehearsalEvidenceFile,
    historical.freshRecoveryPreparation.preflightEvidenceFile,
    historical.freshRecoveryPreparation.recoveryEvidenceFile,
    'shopify-ownership-check-41d468410f65cd0f95f464fdc11cba7c.json',
  ]) {
    const missing = structuredClone(proposal);
    missing.evidenceFiles = missing.evidenceFiles.filter(f => f.path !== 'docs/' + path);
    assert.throws(() => assertClosure(missing), /Missing repository evidence dependency/);
  }
});
