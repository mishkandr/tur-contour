import { addLocaleMessages, formatDate, getLocale, t } from '/locale.js';

addLocaleMessages([
  ['Вопрос по данным','Ask the data','询问数据'],
  ['Вопрос ИИ','Question for AI','向人工智能提问'],
  ['Задайте вопрос по данным','Ask about connected data','询问已连接的数据'],
  ['Например: работает ли Суздальский кремль 21 ноября для группы из 18 человек?','For example: is the Suzdal Kremlin open on 21 November for a group of 18?','例如：11月21日苏兹达尔克里姆林宫可接待18人的团队吗？'],
  ['Спросить','Ask','提问'],
  ['Проверяем источники…','Checking sources…','正在核查数据源…'],
  ['Источники ответа','Sources for this answer','答案来源'],
  ['ИИ распознал тему','AI identified the topic','人工智能识别了主题'],
  ['Условия для группы','Group visit conditions','团队参观条件'],
  ['Сезонность размещения','Accommodation seasonality','住宿季节性'],
  ['Какие программы затронуты','Affected itineraries','受影响的行程'],
  ['Какие данные подключены','Connected data','已连接数据'],
  ['Дата не указана источником','No date reported by the source','数据源未提供日期'],
]);

const safe = value=>String(value ?? '').replace(/[&<>"']/gu,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
const tr = value=>safe(t(value));
const safeUrl = value=>typeof value==='string' && /^(?:https:\/\/|\/(?:api\/)|#(?:overview|impact|stats|catalog|sources|route)\b)/u.test(value) ? value : '';
const labelMap = [
  ['Условия для группы','Работает ли Суздальский кремль 21 ноября 2026 для группы из 18 человек?',
    'Is the Suzdal Kremlin open on 21 November 2026 for a group of 18 people?','苏兹达尔克里姆林宫2026年11月21日开放吗？18人团队。'],
  ['Сезонность размещения','Какие месяцы за последние три года во Владимирской области были с минимумом размещённых лиц?',
    'Which months had the fewest guests in Vladimir Oblast over the last three years?','过去三年弗拉基米尔州哪些月份的住宿人数最少？'],
  ['Какие программы затронуты','Какие программы затронуты изменениями?', 'Which itineraries are affected by changes?', '哪些行程受变更影响？'],
  ['Какие данные подключены','Какие данные и источники подключены?', 'Which sources are connected?', '连接了哪些数据源？'],
];
const thread=[];
let draft='';

function external(url,label,css='') {
  const href = safeUrl(url);
  if (!href) return safe(label);
  return '<a '+(css?'class="'+css+'" ':'')+'href="'+safe(href)+'"'+(!href.startsWith('#')?' target="_blank" rel="noopener noreferrer"':'')+'>'+safe(label)+'</a>';
}

function responseMarkup(answer) {
  if (!answer) return '<p class="caption" role="status">'+tr('Проверяем источники…')+'</p>';
  const items = Array.isArray(answer.items) ? answer.items : [];
  const sources = Array.isArray(answer.sources) ? answer.sources : [];
  const actions = Array.isArray(answer.actions) ? answer.actions : [];
  return '<div class="knowledge-answer"><h2>'+safe(answer.title)+'</h2><p>'+safe(answer.text)+'</p>'+
    (answer.mode==='classified'?'<p class="caption">'+tr('ИИ распознал тему')+'</p>':'')+
    (items.length?'<dl class="knowledge-items">'+items.map(item=>'<dt>'+(item.href?external(item.href,item.title):safe(item.title))+'</dt><dd>'+
      '<span'+(item.lang==='ru'?' lang="ru"':'')+'>'+safe(item.text)+'</span>'+
      (item.status?'<small class="caption knowledge-item-status">'+safe(item.status)+'</small>':'')+
      (Number.isFinite(Date.parse(item.checkedAt))?'<small class="caption knowledge-item-status">'+safe(formatDate(item.checkedAt))+'</small>':'')+
      '</dd>').join('')+'</dl>':'')+
    (sources.length?'<div class="knowledge-references"><h3>'+tr('Источники ответа')+'</h3><ul>'+sources.map(source=>
      '<li>'+external(source.url,source.title)+'<span class="caption">'+
      (Number.isFinite(Date.parse(source.checkedAt))?safe(formatDate(source.checkedAt)):tr('Дата не указана источником'))+'</span></li>').join('')+'</ul></div>':'')+
    (actions.length?'<div class="actions">'+actions.map(action=>external(action.href,action.title,'button-quiet')).join('')+'</div>':'')+'</div>';
}

export function mountKnowledge(container, api, settings, regionId) {
  const find = selector=>container.querySelector(selector);
  const lang=()=>({ru:1,en:2,zh:3})[getLocale()];
  let active=true;
  container.innerHTML='<header class="page-head"><h1>'+tr('Вопрос по данным')+'</h1></header><div class="knowledge-layout">'+
    '<section class="panel knowledge-feed" aria-label="'+tr('Вопрос по данным')+'"><div id="knowledge-thread" aria-live="polite"></div>'+
    '<form id="knowledge-form"><label class="field"><span>'+tr('Вопрос ИИ')+'</span><textarea name="question" required minlength="3" maxlength="600" rows="3" placeholder="'+
    tr('Например: работает ли Суздальский кремль 21 ноября для группы из 18 человек?')+'">'+safe(draft)+'</textarea></label>'+
    '<button class="button" type="submit">'+tr('Спросить')+'</button></form></section><aside class="panel knowledge-samples"><h2>'+
    tr('Задайте вопрос по данным')+'</h2><ul>'+labelMap.map((entry,i)=>'<li><button type="button" class="button-quiet" data-knowledge-example="'+i+'">'+
    tr(entry[0])+'</button></li>').join('')+'</ul></aside></div>';
  const form=find('#knowledge-form');
  function paint(move=false) {
    if (!active) return;
    find('#knowledge-thread').innerHTML=thread.map(entry=>'<article class="knowledge-message"><p class="knowledge-question" data-source-text>'+safe(entry.question)+
      '</p>'+responseMarkup(entry.answer)+'</article>').join('');
    const pending=thread.some(entry=>!entry.answer);
    form.querySelector('button').disabled=pending;
    form.querySelector('button').textContent=t(pending?'Проверяем источники…':'Спросить');
    if (move) find('.knowledge-message:last-child')?.scrollIntoView({block:'nearest'});
  }
  async function send(event) {
    event.preventDefault();
    const question=form.elements.question.value.trim();
    if (question.length<3 || thread.some(entry=>!entry.answer)) return;
    const entry={question,answer:null};
    thread.push(entry);
    if (thread.length>16) thread.shift();
    draft='';
    form.elements.question.value='';
    paint(true);
    try {entry.answer=await api('knowledge',{question,locale:getLocale(),settings,regionId});}
    catch(error) {entry.answer={title:t('Вопрос по данным'),text:t(error.message)};}
    paint(true);
  }
  function samples(event) {
    const button=event.target.closest('[data-knowledge-example]');
    if (!button) return;
    const index=Number(button.dataset.knowledgeExample);
    const regional=['Какие месяцы за последние три года были с минимумом размещённых лиц?',
      'Which months had the fewest guests over the last three years?','过去三年哪些月份的住宿人数最少？'];
    draft=form.elements.question.value=regionId && index===1 ? regional[lang()-1] : labelMap[index][lang()];
    form.elements.question.focus();
  }
  const input=()=>{draft=form.elements.question.value;};
  form.addEventListener('submit',send);
  form.addEventListener('input',input);
  container.addEventListener('click',samples);
  paint();
  return {destroy(){active=false;container.removeEventListener('click',samples);}};
}
