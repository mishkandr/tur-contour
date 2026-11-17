import assert from 'node:assert/strict';
import { test } from 'node:test';
import { suggestRoute } from '../route-ai.mjs';

function candidate(id, visit, { completeness = true, theme = 'heritage', end = '11:00' } = {}) {
  return {
    id, title: id,
    plan: { completeness, days: [{ city: 'Суздаль', stops: [{
      type: 'visit', id: visit, name: 'Объект ' + visit, start: '10:00', end, theme,
    }] }] },
  };
}

const alternatives = [candidate('a', 'museum', { theme: 'museum', end: '12:00' }), candidate('b', 'church')];
const options = { model: 'test-model', baseUrl: 'http://127.0.0.1:11434' };
const answer = choices => ({ ok: true, json: async () => ({ message: { content: JSON.stringify({ choices }) } }) });

test('uses a structured local request and explains only known, feasible choices', async () => {
  const result = await suggestRoute({
    settings: { theme: 'museum' }, alternatives: [...alternatives, candidate('c', 'park', { completeness: false })],
    issue: 'Площадка закрывается в 12:00', brief: 'История и архитектура',
  }, {
    ...options,
    fetchImpl: async (url, request) => {
      assert.equal(String(url), options.baseUrl + '/api/chat');
      const payload = JSON.parse(request.body);
      assert.deepEqual(payload.format.properties.choices.items.enum, ['A1', 'B1']);
      assert.equal(JSON.parse(payload.messages.at(-1).content).brief, 'История и архитектура');
      return answer(['B1', 'A1']);
    },
  });
  assert.equal(result.status, 'live');
  assert.deepEqual(result.suggestions, [
    { id: 'b', explanation: 'Историко-архитектурный акцент — «Объект church» (день 1).' },
    { id: 'a', explanation: 'Музейный акцент — «Объект museum» (день 1).' },
  ]);
});

test('does not ask a model to compare a single feasible programme', async () => {
  let calls = 0;
  const result = await suggestRoute({ settings: {}, alternatives: alternatives.slice(0, 1) }, {
    ...options, fetchImpl: () => { calls += 1; },
  });
  assert.equal(calls, 0);
  assert.equal(result.status, 'insufficient');
});

test('rejects codes outside the actual feasible programmes', async () => {
  for (const choices of [['Z1'], ['B2'], ['A1', 'B1', 'C1']]) {
    const result = await suggestRoute({ settings: {}, alternatives }, {
      ...options, fetchImpl: async () => answer(choices),
    });
    assert.equal(result.status, 'unavailable');
    assert.deepEqual(result.suggestions, []);
  }
});

test('shows each chosen programme once, with the actual theme and schedule', async () => {
  const result = await suggestRoute({ settings: {}, alternatives }, {
    ...options, fetchImpl: async () => answer(['B1', 'B1']),
  });
  assert.equal(result.status, 'live');
  assert.deepEqual(result.suggestions, [{ id: 'b', explanation: 'Историко-архитектурный акцент — «Объект church» (день 1).' }]);
});

test('reports when Ollama is unavailable', async () => {
  const result = await suggestRoute({ settings: {}, alternatives }, {
    ...options, fetchImpl: async () => { throw new Error('Connection failed'); },
  });
  assert.equal(result.status, 'unavailable');
  assert.deepEqual(result.suggestions, []);
});
