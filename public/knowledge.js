import { addLocaleMessages, formatDate, formatNumber, getLocale, t } from '/locale.js';

addLocaleMessages([
  ['Вопрос по данным','Ask the data','询问数据'],
  ['Ваш вопрос','Your question','您的问题'],
  ['Например: какие музеи есть в каталоге?','For example: which museums are in the catalogue?','例如：目录中有哪些博物馆？'],
  ['Музеи','Museums','博物馆'],
  ['Рестораны','Restaurants','餐厅'],
  ['Ночёвки по региону','Overnight stays in the region','地区住宿夜数'],
  ['К обзору города','Back to city overview','返回城市概览'],
  ['Спросить','Ask','提问'],
  ['Проверяем источники…','Checking sources…','正在核查数据源…'],
  ['Отменить запрос','Cancel request','取消请求'],
  ['Повторить запрос','Retry request','重试请求'],
  ['Запрос отменён.','Request canceled.','请求已取消。'],
  ['Запрос не завершился. Повторите попытку.','The request did not complete. Please retry.','请求未完成，请重试。'],
  ['Ответ готов.','Answer ready.','回答已就绪。'],
  ['Прошло {seconds} с','{seconds}s elapsed','已用 {seconds} 秒'],
  ['Источники ответа','Sources for this answer','答案来源'],
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
  ['Музеи','Какие музеи есть в каталоге?','Which museums are in the catalogue?','目录中有哪些博物馆？'],
  ['Рестораны','Какие рестораны есть в каталоге?','Which restaurants are in the catalogue?','目录中有哪些餐厅？'],
  ['Ночёвки по региону','Сколько ночёвок было в регионе за 2025 год?',
    'How many overnight stays were recorded in the region in 2025?','2025 年该地区共有多少住宿夜数？'],
  ['Какие данные подключены','Какие данные и источники подключены?', 'Which sources are connected?', '连接了哪些数据源？'],
];
const workspaces=new Map();

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

export function mountKnowledge(container, api, settings, regionId, cityId) {
  const find = selector=>container.querySelector(selector);
  const lang=()=>({ru:1,en:2,zh:3})[getLocale()];
  let active=true;
  let pending;
  const key=cityId ?? regionId ?? '';
  if (!workspaces.has(key)) {
    if (workspaces.size>=12) workspaces.delete(workspaces.keys().next().value);
    workspaces.set(key,{thread:[],draft:''});
  }
  const workspace=workspaces.get(key);
  const {thread}=workspace;
  const examples=cityId ? labelMap : labelMap.slice(2);
  container.innerHTML='<header class="page-head"><div><h1>'+tr('Вопрос по данным')+'</h1><p id="knowledge-city" class="caption" hidden></p></div>'+
    (cityId?external('#overview?city='+encodeURIComponent(cityId),t('К обзору города'),'button-quiet'):'')+'</header><div class="knowledge-layout">'+
    '<section class="panel knowledge-feed" aria-label="'+tr('Вопрос по данным')+'"><div id="knowledge-thread"></div>'+
    '<p id="knowledge-announcement" class="sr-only" role="status"></p>'+
    '<form id="knowledge-form"><label class="field"><span class="sr-only">'+tr('Ваш вопрос')+'</span><textarea name="question" required minlength="3" maxlength="600" rows="3" placeholder="'+
    tr('Например: какие музеи есть в каталоге?')+'">'+safe(workspace.draft)+'</textarea></label>'+
    '<div class="knowledge-actions"><button class="button" type="submit">'+tr('Спросить')+'</button>'+
    examples.map((entry,i)=>'<button type="button" class="button-quiet" data-knowledge-example="'+i+'">'+tr(entry[0])+'</button>').join('')+
    '</div></form></section></div>';
  if (/^\d{1,12}$/u.test(cityId ?? '')) void api('cities?id='+cityId).then(({cities:[city]})=>{
    if (!active || !city) return;
    const label=find('#knowledge-city');
    label.textContent=city[getLocale()==='zh' ? 'cn' : 'en'] && getLocale()!=='ru' ? city[getLocale()==='zh' ? 'cn' : 'en'] : city.name;
    label.hidden=false;
  }).catch(()=>{});
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
    const entry={question,query:{question,settings,regionId,cityId},answer:null};
    thread.push(entry);
    if (thread.length>16) thread.shift();
    workspace.draft='';
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
    form.elements.question.value=examples[index][lang()];
    form.requestSubmit();
  }
  const input=()=>{workspace.draft=form.elements.question.value;};
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
