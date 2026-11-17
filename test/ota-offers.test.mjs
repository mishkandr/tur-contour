import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { getDemoOffers } from '../ota-offers.mjs';

const feed = JSON.parse(await readFile(new URL('../data/demo-ota.json',import.meta.url),'utf8'));

test('accommodation sources use exact dates and occupancy and keep shared venue inventory separate', () => {
  const snapshot = getDemoOffers(feed,{date:'2026-11-21',occupancy:2});
  assert.equal(snapshot.synthetic,true);
  assert.equal(snapshot.groupAvailability,'unconfirmed');
  assert.equal(snapshot.nights,1);
  assert.equal(snapshot.availablePlaceCount,2);
  assert.equal(snapshot.objects.length,2);
  assert.equal(snapshot.providers.length,2);
  assert.ok(snapshot.providers.every(provider => provider.coverage==='snapshot' && provider.version && provider.checkedAt));
  assert.deepEqual(snapshot.objects.find(item => item.id==='amaks').offers,[
    {providerId:'sample-a',priceRub:5600,roomsListed:3},
    {providerId:'sample-b',priceRub:5850,roomsListed:2},
  ]);
  assert.equal(snapshot.objects.find(item => item.id==='nposad').offers[1].roomsListed,0);
  const oneGuest = getDemoOffers(feed,{date:'2026-11-21',occupancy:1});
  assert.deepEqual(oneGuest.objects.map(item => item.id),['amaks']);
  const nextNight = getDemoOffers(feed,{date:'2026-11-22',occupancy:2});
  assert.equal(nextNight.objects.find(item => item.id==='amaks').offers[0].priceRub,5100);
});

test('uncovered date or occupancy is missing evidence rather than zero inventory', () => {
  for (const selection of [{date:'2026-11-23',occupancy:2},{date:'2026-11-21',occupancy:3},{date:'2026-02-30',occupancy:2}]) {
    const missing = getDemoOffers(feed,selection);
    assert.equal(missing.coverage,'none');
    assert.equal(missing.availablePlaceCount,0);
    assert.deepEqual(missing.objects,[]);
    assert.ok(missing.providers.every(provider => provider.coverage==='none'));
  }
  assert.throws(() => getDemoOffers({...feed,synthetic:false},{date:'2026-11-21'}),/демонстрационная выгрузка/u);
});
