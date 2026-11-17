const themeLabels = {
  museum: 'Музейный акцент',
  heritage: 'Историко-архитектурный акцент',
};

const minutes = clock => {
  const [hours, mins] = clock.split(':').map(Number);
  return hours * 60 + mins;
};

function prepareCandidate({ id, plan }, index, anchors, places) {
  let duration = 0;
  let anchorNumber = 0;
  const label = String.fromCharCode(65 + index);
  const days = plan.days.map(({ stops }, dayIndex) => {
    const first = stops[0];
    const last = stops.at(-1);
    if (first && last) duration += minutes(last.end) - minutes(first.start);
    return stops.filter(stop => stop.type === 'visit').map(visit => {
      const code = label + (++anchorNumber);
      anchors.set(code, { id, day: dayIndex + 1, visit });
      if (!places.has(visit.id)) places.set(visit.id,{number:places.size+1,name:visit.name,theme:visit.theme});
      return code+':'+places.get(visit.id).number+(visit.split?'*':'');
    });
  });
  return [label, duration, days];
}

function explainResult(content, anchors, maxChoices) {
  const { choices } = JSON.parse(content);
  if (!Array.isArray(choices) || !choices.length || choices.length > maxChoices ||
      choices.some(choice => !anchors.has(choice))) {
    throw new Error('Некорректные ссылки на варианты');
  }
  const unique = new Map();
  for (const choice of choices) {
    const { id, day, visit } = anchors.get(choice);
    if (unique.has(id)) continue;
    const focus = themeLabels[visit.theme] ?? 'Смысловой акцент';
    const split = visit.split ? ' В расписании предусмотрены два сеанса.' : '';
    unique.set(id, { id, explanation: focus + ' — «' + visit.name + '» (день ' + day + ').' + split });
  }
  return [...unique.values()];
}

export async function suggestRoute({ settings, alternatives, issue, brief }, { model, baseUrl, fetchImpl = fetch }) {
  const anchors = new Map();
  const places = new Map();
  const eligible = alternatives.filter(({ plan }) =>
    plan.completeness && plan.days.some(day => day.stops.some(stop => stop.type === 'visit'))).slice(0, 6);
  if (eligible.length < 2) {
    return { status: 'insufficient', model, suggestions: [], message: 'Для сравнения нужны хотя бы два варианта, прошедших проверку условий.' };
  }
  const candidates = eligible.map((alternative, index) => prepareCandidate(alternative, index, anchors,places));
  const placeNames = Object.fromEntries([...places.values()].map(({number,name,theme})=>[number,[name,theme]]));
  const requirement = typeof brief === 'string' ? brief.trim().slice(0, 400) : '';
  const problem = typeof issue === 'string' ? issue.trim().slice(0, 400) : '';
  const maxChoices = Math.min(eligible.length, 3);
  const format = {
    type: 'object',
    additionalProperties: false,
    required: ['choices'],
    properties: {
      choices: {
        type: 'array', minItems: 1, maxItems: maxChoices,
        items: { type: 'string', enum: [...anchors.keys()] },
      },
    },
  };

  try {
    const response = await fetchImpl(new URL('/api/chat', baseUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(65000),
      body: JSON.stringify({
        model, stream: false, think: false, format, keep_alive:'15m',
        options: { temperature: 0, num_predict: 55, num_ctx: 4096 },
        messages: [{
          role: 'system',
          content: 'Сравни варианты по теме и brief. Вариант: [буква, минуты, дни]. В днях код:номер объекта из places, * означает два сеанса. '
            + 'Верни JSON choices из максимум трёх кодов, по одному на букву, лучший первым. Код должен отмечать остановку, '
            + 'которая лучше поддерживает пожелание для нужного дня. Heritage — история и архитектура, museum — музеи.',
        }, {
          role: 'user',
          content: JSON.stringify({theme:settings.theme,issue:problem,brief:requirement,places:placeNames,alternatives:candidates}),
        }],
      }),
    });
    if (!response.ok) throw new Error('Ollama HTTP ' + response.status);
    const { message } = await response.json();
    const suggestions = explainResult(message.content, anchors, maxChoices);
    return { status: 'live', model, suggestions, message: 'Модель расставила варианты по смыслу программы. Специалист проверяет предложения и выбирает вариант.' };
  } catch {
    return { status: 'unavailable', model, suggestions: [], message: 'Подсказка ИИ сейчас недоступна. Проверенные программой варианты можно сравнить вручную.' };
  }
}
