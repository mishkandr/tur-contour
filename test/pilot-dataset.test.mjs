import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { pilotDatasetCsv } from '../pilot-dataset.mjs';

function readRows(csv) {
  const [columns,...rows] = csv.slice(1).trimEnd().split('\n').map(line=>
    [...line.matchAll(/"((?:[^"]|"")*)"(?=;|$)/g)].map(match=>match[1].replaceAll('""','"')));
  return rows.map(row=>{
    assert.equal(row.length,columns.length);
    return Object.fromEntries(columns.map((key,index)=>[key,row[index]]));
  });
}

test('the pilot dataset export matches the snapshot committed to the repository', async t=>{
  const directory = await mkdtemp(join(tmpdir(),'tur-dataset-test-'));
  const originalState = process.env.TUR_STATE_DIR;
  process.env.TUR_STATE_DIR = directory;
  t.after(async()=>{
    if (originalState===undefined) delete process.env.TUR_STATE_DIR;
    else process.env.TUR_STATE_DIR = originalState;
    await rm(directory,{recursive:true,force:true});
  });
  const {handleRequest} = await import('../server.mjs');
  const {headers,content} = await new Promise((done,reject)=>{
    let headers;
    handleRequest({url:'/api/pilot-dataset.csv',method:'GET'},{
      writeHead(status,values) { assert.equal(status,200); headers=values; },
      end(content) { done({headers,content}); },
    }).catch(reject);
  });
  assert.equal(headers['Content-Type'],'text/csv; charset=utf-8');
  assert.match(headers['Content-Disposition'],/^attachment;.*\.csv"$/);
  assert.equal(content[0],'\uFEFF');
  assert.equal(content,await readFile(new URL('../data/pilot-dataset.csv',import.meta.url),'utf8'));
  const rows = readRows(content);
  const places = new Map(rows.map(row=>[row.ID,row]));
  assert.equal(rows.length,30);
  assert.equal(places.size,30);
  assert.equal(rows.filter(row=>row['Статус опубликованных сведений']==='Есть опубликованные сведения').length,28);
  assert.equal(rows.filter(row=>row['Дата сверки публикаций']==='2026-11-17').length,28);
  const kremlin = places.get('suzdal-kremlin');
  assert.equal(kremlin['Плановый переезд до города, мин'],'60');
  assert.equal(kremlin['Откуда переезд'],'Владимир');
  assert.equal(kremlin['График по'],'2026-12-29');
  assert.match(kremlin['Запись'],/заявк.+за 7 дн/);
  assert.match(kremlin['Лимиты и условия отдельных услуг'],/20 участников у сборной/);
  assert.match(kremlin['Что уточнить перед поездкой'],/Предельный размер организованной группы/);
  assert.match(kremlin['Происхождение в материалах МАГ'],/Музеи, объекты ЮНЕСКО.+6/);
  const kideksha = places.get('kideksha');
  assert.equal(kideksha['Плановый переезд до города, мин'],'25');
  assert.equal(kideksha['Статус опубликованных сведений'],'Требуется сверка условий');
  assert.equal(kideksha['Дата сверки публикаций'],'');
  assert.equal(kideksha['График и исключения'],'');
  assert.equal(places.get('sloboda')['Плановый переезд до города, мин'],'');
  assert.equal(places.get('murom-hotel')['Плановый переезд до города, мин'],'170');
});

test('dataset export quotes field delimiters and protects text cells from formula import', ()=>{
  const name = '  =SEARCH(";", B1)';
  const csv = pilotDatasetCsv([{id:'test',city:'Владимир',name,kind:'visit'}],{},{});
  assert.match(csv,/"'  =SEARCH\("";"", B1\)"/);
  assert.equal(readRows(csv)[0]['Объект'],"'"+name);
});
