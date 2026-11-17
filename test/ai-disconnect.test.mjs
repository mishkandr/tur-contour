import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { test } from 'node:test';
import { defaultRoute } from '../engine.mjs';

test('a disconnected chat, route review or brief releases its model request', { timeout:5000 }, async t => {
  const directory=await mkdtemp(join(tmpdir(),'tur-ai-disconnect-'));
  const previousFetch=globalThis.fetch;
  const previousDirectory=process.env.TUR_STATE_DIR;
  const previousModelFlag=process.env.TUR_NO_LLM;
  process.env.TUR_STATE_DIR=directory;
  delete process.env.TUR_NO_LLM;
  t.after(async()=>{
    globalThis.fetch=previousFetch;
    if (previousDirectory===undefined) delete process.env.TUR_STATE_DIR;
    else process.env.TUR_STATE_DIR=previousDirectory;
    if (previousModelFlag===undefined) delete process.env.TUR_NO_LLM;
    else process.env.TUR_NO_LLM=previousModelFlag;
    await rm(directory,{recursive:true,force:true});
  });

  let observe;
  let inferences=0;
  globalThis.fetch=async (url,{signal,body}={})=>{
    if (!String(url).endsWith('/api/chat')) throw new Error('Offline fixture');
    inferences++;
    return new Promise((resolve,reject)=>{
      signal.throwIfAborted();
      signal.addEventListener('abort',()=>reject(signal.reason),{once:true});
      const schema=JSON.parse(body).format.properties;
      const content=schema.choices ? {choices:[schema.choices.items.enum[0]]} : schema.intent ? {intent:'places'} : {};
      observe({signal,finish:()=>resolve({ok:true,json:async()=>({message:{content:JSON.stringify(content)}})})});
    });
  };
  const { handleRequest }=await import('../server.mjs');

  function submit(url,body) {
    const request=Object.assign(Readable.from([JSON.stringify(body)]),{url,method:'POST'});
    const response=Object.assign(new EventEmitter(),{
      destroyed:false,writableFinished:false,
      writeHead(status){ this.status=status; },
      end(json){ this.writableFinished=true; this.payload=JSON.parse(json); },
    });
    return {
      finished:handleRequest(request,response),response,
      close(){ response.destroyed=true; response.emit('close'); },
    };
  }
  const nextInference=()=>new Promise(resolve=>{ observe=resolve; });
  const endpoints=[
    ['/api/knowledge',{question:'Поясни это подробнее'}],
    ['/api/route-ai',{settings:defaultRoute,brief:'Сохранить тему архитектуры'}],
    ['/api/brief',{mode:'ai',text:'Владимир, интересуют архитектура и искусство'}],
  ];
  for (const [url,body] of endpoints) {
    const pending=nextInference();
    const disconnected=submit(url,body);
    const {signal}=await pending;
    disconnected.close();
    await disconnected.finished;
    assert.equal(signal.aborted,true,url);
    assert.equal(disconnected.response.writableFinished,false,url);
  }

  const pending=nextInference();
  const [url,body]=endpoints[1];
  const active=submit(url,body);
  const inference=await pending;
  const waiting=submit(url,body);
  await new Promise(resolve=>setImmediate(resolve));
  waiting.close();
  await waiting.finished;
  assert.equal(inferences,4);
  const retryInference=nextInference();
  const retry=submit(url,body);
  inference.finish();
  await active.finished;
  (await retryInference).finish();
  await retry.finished;
  assert.equal(retry.response.status,200);
  assert.equal(retry.response.payload.status,'live');
});
