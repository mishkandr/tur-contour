import { addLocaleMessages, formatDate, formatNumber, getLocale, t } from '/locale.js';

addLocaleMessages([
  ['Вопрос по данным','Ask the data','询问数据'],
  ['Вопрос ИИ','Question for AI','向人工智能提问'],
  ['Задайте вопрос по данным','Ask about connected data','询问已连接的数据'],
  ['Например: работает ли Суздальский кремль 21 ноября для группы из 18 человек?','For example: is the Suzdal Kremlin open on 21 November for a group of 18?','例如：11月21日苏兹达尔克里姆林宫可接待18人的团队吗？'],
  ['Спросить','Ask','提问'],
  ['Проверяем источники…','Checking sources…','正在核查数据源…'],
  ['Отменить запрос','Cancel request','取消请求'],
  ['Повторить запрос','Retry request','重试请求'],
  ['Запрос отменён.','Request canceled.','请求已取消。'],
  ['Запрос не завершился. Повторите попытку.','The request did not complete. Please retry.','请求未完成，请重试。'],
  ['Ответ готов.','Answer ready.','回答已就绪。'],
  ['Прошло {seconds} с','{seconds}s elapsed','已用 {seconds} 秒'],
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

function elapsedLabel(startedAt) {
  return t('Прошло {seconds} с',{seconds:formatNumber(Math.floor(Math.max(0,Date.now()-startedAt)/1000))});
}

export function aiWaitingMarkup(label, startedAt, cancelAction) {
  const statusId=safe(cancelAction)+'-status';
  return '<div class="ai-wait"><div class="ai-wait-head"><p class="detail" id="'+statusId+'" role="status">'+tr(label)+'</p>'+
    '<span class="caption ai-wait-time" data-ai-elapsed aria-hidden="true">'+safe(elapsedLabel(startedAt))+'</span></div>'+
    '<progress aria-labelledby="'+statusId+'"></progress><button type="button" class="button-quiet" data-action="'+safe(cancelAction)+
    '" aria-describedby="'+statusId+'">'+
    tr('Отменить запрос')+'</button></div>';
}

export function updateAiWait(container, startedAt) {
  const elapsed=container?.querySelector('[data-ai-elapsed]');
  if (elapsed) elapsed.textContent=elapsedLabel(startedAt);
}

function external(url,label,css='') {
  const href = safeUrl(url);
  if (!href) return safe(label);
  return '<a '+(css?'class="'+css+'" ':'')+'href="'+safe(href)+'"'+(!href.startsWith('#')?' target="_blank" rel="noopener noreferrer"':'')+'>'+safe(label)+'</a>';
}

function responseMarkup(answer) {
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
  let pending;
  container.innerHTML='<header class="page-head"><h1>'+tr('Вопрос по данным')+'</h1></header><div class="knowledge-layout">'+
    '<section class="panel knowledge-feed" aria-label="'+tr('Вопрос по данным')+'"><div id="knowledge-thread"></div>'+
    '<p id="knowledge-announcement" class="sr-only" role="status"></p>'+
    '<form id="knowledge-form"><label class="field"><span>'+tr('Вопрос ИИ')+'</span><textarea name="question" required minlength="3" maxlength="600" rows="3" placeholder="'+
    tr('Например: работает ли Суздальский кремль 21 ноября для группы из 18 человек?')+'">'+safe(draft)+'</textarea></label>'+
    '<button class="button" type="submit">'+tr('Спросить')+'</button></form></section><aside class="panel knowledge-samples"><h2>'+
    tr('Задайте вопрос по данным')+'</h2><ul>'+labelMap.map((entry,i)=>'<li><button type="button" class="button-quiet" data-knowledge-example="'+i+'">'+
    tr(entry[0])+'</button></li>').join('')+'</ul></aside></div>';
  const form=find('#knowledge-form');
  const history=find('#knowledge-thread');
  const submit=form.querySelector('[type=submit]');
  function paintEntry(entry,index) {
    if (entry.answer) return responseMarkup(entry.answer);
    if (pending?.entry===entry) return aiWaitingMarkup('Проверяем источники…',pending.startedAt,'cancel-knowledge');
    const label = entry.error ? t(entry.error) : t('Запрос отменён.');
    return '<div class="ai-request-result"><p class="'+(entry.error?'callout':'caption')+'">'+safe(label)+'</p>'+
      '<button type="button" class="button-quiet" data-action="retry-knowledge" data-entry="'+index+'"'+(pending?' disabled':'')+'>'+
      tr('Повторить запрос')+'</button></div>';
  }
  function paint(move=false) {
    if (!active) return;
    history.innerHTML=thread.map((entry,index)=>'<article class="knowledge-message"><p class="knowledge-question" data-source-text>'+safe(entry.question)+
      '</p>'+paintEntry(entry,index)+'</article>').join('');
    submit.disabled=Boolean(pending);
    if (move) find('[data-action="cancel-knowledge"]')?.scrollIntoView({block:'nearest'});
  }
  function focusRetry(entry) {
    find('[data-action="retry-knowledge"][data-entry="'+thread.indexOf(entry)+'"]')?.focus({preventScroll:true});
  }
  function cancel(announce=false) {
    if (!pending) return;
    const request=pending;
    pending=null;
    clearInterval(request.timer);
    request.controller.abort();
    if (!announce) return;
    paint();
    find('#knowledge-announcement').textContent=t('Запрос отменён.');
    focusRetry(request.entry);
  }
  async function ask(entry) {
    if (pending) return;
    const request={entry,controller:new AbortController(),startedAt:Date.now()};
    pending=request;
    entry.error='';
    find('#knowledge-announcement').textContent='';
    paint(true);
    find('[data-action="cancel-knowledge"]').focus({preventScroll:true});
    request.timer=setInterval(()=>updateAiWait(history,request.startedAt),1000);
    try {
      const answer=await api('knowledge',{...entry.query,locale:getLocale()},'POST',{signal:request.controller.signal});
      if (pending===request) entry.answer=answer;
    } catch(error) {
      if (pending===request) entry.error=error.status ? error.message : 'Запрос не завершился. Повторите попытку.';
    } finally {
      if (pending===request) {
        const restoreFocus=document.activeElement===find('[data-action="cancel-knowledge"]');
        pending=null;
        clearInterval(request.timer);
        paint();
        find('#knowledge-announcement').textContent=t(entry.error || 'Ответ готов.');
        if (restoreFocus) {
          if (entry.error) focusRetry(entry);
          else form.elements.question.focus({preventScroll:true});
        }
      }
    }
  }
  function send(event) {
    event.preventDefault();
    const question=form.elements.question.value.trim();
    if (question.length<3 || pending) return;
    const entry={question,query:{question,settings,regionId},answer:null};
    thread.push(entry);
    if (thread.length>16) thread.shift();
    draft='';
    form.elements.question.value='';
    void ask(entry);
  }
  function actions(event) {
    const control=event.target.closest('[data-action="cancel-knowledge"],[data-action="retry-knowledge"]');
    if (control?.dataset.action==='cancel-knowledge') { cancel(true); return; }
    if (control?.dataset.action==='retry-knowledge') {
      const entry=thread[Number(control.dataset.entry)];
      if (entry && !entry.answer) void ask(entry);
      return;
    }
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
  container.addEventListener('click',actions);
  paint();
  return {
    get waiting(){ return Boolean(pending); },
    destroy(){
      active=false;
      cancel();
      form.removeEventListener('submit',send);
      form.removeEventListener('input',input);
      container.removeEventListener('click',actions);
    },
  };
}
