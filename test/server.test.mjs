import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';
import { defaultRoute } from '../engine.mjs';

test('the request flow updates evidence, checks routes and persists analyst decisions', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'tur-contour-test-'));
  const feedPath = join(directory, 'verified.json');
  const savedFetch = globalThis.fetch;
  process.env.TUR_STATE_DIR = directory;
  process.env.TUR_AUDIT_FEED_FILE = feedPath;
  process.env.TUR_NO_LLM = '1';
  globalThis.fetch = async () => { throw new Error('Offline test'); };
  t.after(async () => {
    globalThis.fetch = savedFetch;
    delete process.env.TUR_STATE_DIR;
    delete process.env.TUR_AUDIT_FEED_FILE;
    delete process.env.TUR_NO_LLM;
    await rm(directory,{recursive:true,force:true});
  });

  const { handleRequest } = await import('../server.mjs');
  async function request(url, body) {
    const req = Object.assign(Readable.from(body ? [JSON.stringify(body)] : []),{url,method:body ? 'POST' : 'GET'});
    return new Promise((done,reject) => {
      let status;
      handleRequest(req,{
        writeHead(code) { status = code; },
        end(content) { done({status,payload:JSON.parse(content)}); },
      }).catch(reject);
    });
  }

  const initial = (await request('/api/state')).payload;
  assert.equal(initial.portfolio.currentCount,2);
  assert.equal(initial.auditFeed.state,'pending');
  assert.equal(initial.places.length,20);

  const original = (await request('/api/alternatives',defaultRoute)).payload.options[0];
  assert.ok(original.plan.days[1].stops.some(stop => stop.id === 'suzdal-kremlin'));
  const changed = (await request('/api/audit',{version:'2'})).payload;
  assert.equal(changed.portfolio.currentCount,1);
  assert.deepEqual(changed.affected.filter(item => item.affected).map(item => item.id),['group-cn']);
  assert.equal(changed.portfolio.scenarios.find(item => item.id === 'split').delta,1);
  const stale = await request('/api/approve',{settings:defaultRoute,variantId:original.id,planSignature:original.signature});
  assert.equal(stale.status,409);

  const variants = (await request('/api/alternatives',defaultRoute)).payload.options;
  const replacement = variants.find(item => !item.plan.days[1].stops.some(stop => stop.id === 'suzdal-kremlin'));
  assert.ok(replacement.plan.completeness);
  assert.ok(replacement.plan.days[1].stops.some(stop => stop.cn));
  const approval = {settings:defaultRoute,variantId:replacement.id,planSignature:replacement.signature,programId:'group-cn'};
  const [first,retry] = await Promise.all([request('/api/approve',approval),request('/api/approve',approval)]);
  assert.equal(first.status,200);
  assert.equal(first.payload.decision.id,retry.payload.decision.id);
  assert.equal(first.payload.data.decisions.length,1);
  const tracked = first.payload.data.affected.find(item => item.id === first.payload.decision.programId);
  assert.equal(tracked.id,'group-cn');
  assert.equal(first.payload.data.affected.length,2);
  assert.equal(first.payload.data.portfolio.currentCount,2);
  assert.deepEqual(tracked.currentPlan,replacement.plan);
  const stored = JSON.parse(await readFile(join(directory,'state.json'),'utf8'));
  assert.equal(stored.decisions.length,1);
  assert.equal(stored.savedRoutes.length,1);

  const advice = (await request('/api/route-ai',{settings:defaultRoute,brief:'Сохранить архитектурную тему'})).payload;
  assert.equal(advice.status,'unavailable');
  assert.deepEqual(advice.suggestions,[]);

  const verifiedSettings = {...defaultRoute,demo:false};
  assert.deepEqual((await request('/api/alternatives',verifiedSettings)).payload.options,[]);
  const testAudit = JSON.parse(await readFile(new URL('../data/demo-audit.json',import.meta.url),'utf8'));
  const evidence = {version:'test-1',objects:Object.fromEntries(Object.entries(testAudit.objects).map(([id,entry]) => [id,{
    ...entry,booking:'reservation',verifiedAt:'2025-01-01',validUntil:'2026-11-23',sourceUrl:'https://example.com/test-audit',
  }]))};
  await writeFile(feedPath,JSON.stringify(evidence));
  const refreshed = (await request('/api/refresh',{})).payload;
  assert.equal(refreshed.auditFeed.state,'live');
  assert.equal(refreshed.auditFeed.objectCount,Object.keys(evidence.objects).length);
  assert.equal(refreshed.sources.wiki.status,'error');
  assert.ok(refreshed.changes.some(change => change.id === 'suzdal-kremlin' && change.key === 'verification'));
  const verified = (await request('/api/alternatives',verifiedSettings)).payload.options[0];
  assert.ok(verified.plan.completeness);
  assert.equal(verified.plan.days[1].stops.find(stop => stop.id === 'suzdal-kremlin').sourceUrl,'https://example.com/test-audit');
  assert.deepEqual((await request('/api/alternatives',{...verifiedSettings,date:'2026-12-01'})).payload.options,[]);

  await writeFile(feedPath,'{"version":"broken"}');
  const unavailable = (await request('/api/refresh',{})).payload;
  assert.equal(unavailable.auditFeed.state,'error');
  assert.equal(unavailable.auditFeed.version,'test-1');
});
