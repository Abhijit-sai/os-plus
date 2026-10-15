import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { shopifyPilotTime } from '../src/integrations/shopify/application-display.ts';
test('pilot dates have explicit identical IST output across server/browser locales and time zones',()=>{
  assert.equal(shopifyPilotTime('2026-10-13T00:00:00Z'),'13 Oct 2026, 05:30 IST');
  assert.equal(shopifyPilotTime('2026-10-13T05:30:00+05:30'),'13 Oct 2026, 05:30 IST');
  assert.equal(shopifyPilotTime('bad'),'Date unavailable');
  for(const TZ of ['UTC','America/New_York','Asia/Kolkata']){
    const result=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','-e',`import {shopifyPilotTime} from './src/integrations/shopify/application-display.ts';process.stdout.write(shopifyPilotTime('2026-10-13T00:00:00Z'));`],{cwd:new URL('..',import.meta.url),env:{...process.env,TZ},windowsHide:true,encoding:'utf8'});
    assert.equal(result.status,0);assert.equal(result.stdout,'13 Oct 2026, 05:30 IST');
  }
});
