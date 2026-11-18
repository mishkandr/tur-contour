import { addLocaleMessages, formatDate, formatNumber, t } from '/locale.js';
import { setSourceEnabled, sourceEnabled } from '/source-preferences.js';

addLocaleMessages([
  ['Данные в обзоре','Overview data','概览数据'],
  ['Показывать в обзоре','Show in overview','在概览中显示'],
  ['Каталог мест','Place catalogue','地点目录'],
  ['Статистика размещения','Accommodation statistics','住宿统计'],
  ['Погода','Weather','天气'],
  ['Проекты','Projects','项目'],
  ['Проверить связь','Check connection','检查连接'],
  ['Проверяем…','Checking…','正在检查…'],
  ['Доступен','Available','可用'],
  ['Ошибка связи','Connection error','连接错误'],
  ['Связь ещё не проверяли','Connection not checked yet','尚未检查连接'],
  ['Локальная выборка','Local snapshot','本地快照'],
  ['Росстат через Roschart','Rosstat via Roschart','俄罗斯统计局（Roschart）'],
  ['Официальные реестры и публикации','Official registers and notices','官方登记与公告'],
  ['Журнал ошибок','Error log','错误日志'],
  ['Ошибок проверки пока нет.','No connection errors recorded.','尚无连接错误记录。'],
  ['Не удалось получить статус.','Unable to read status.','无法获取状态。'],
  ['Нет ответа от источника','No response from the source','数据源未响应'],
  ['Неверный формат ответа','Unexpected response format','响应格式异常'],
  ['Подключение недоступно','Connection unavailable','连接不可用'],
  ['{time} мс','{time} ms','{time} 毫秒'],
]);

const groups=[
  {id:'catalog',label:'Каталог мест',feeds:[
    ['openstreetmap','OpenStreetMap · Overpass','https://wiki.openstreetmap.org/wiki/Overpass_API'],
    ['wikipedia','MediaWiki GeoSearch','https://www.mediawiki.org/wiki/API:Geosearch'],
    [null,'GeoNames','https://www.geonames.org/export/'],
  ]},
  {id:'statistics',label:'Статистика размещения',feeds:[
    ['statistics','Росстат через Roschart','https://roschart.ru/docs'],
  ]},
  {id:'weather',label:'Погода',feeds:[
    ['weather','Open-Meteo','https://open-meteo.com/en/docs'],
  ]},
  {id:'projects',label:'Проекты',feeds:[
    [null,'Официальные реестры и публикации',null],
  ]},
];
const feedNames=new Map(groups.flatMap(group=>group.feeds.map(([id,name])=>[id,name])));
const safe=value=>String(value ?? '').replace(/[&<>"']/gu,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
const tr=(message,params)=>safe(t(message,params));
const timestamp=value=>formatDate(value,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
function message(detail) {
  if (/^HTTP \d{3}$/u.test(detail ?? '')) return detail;
  return t({timeout:'Нет ответа от источника',format:'Неверный формат ответа',network:'Подключение недоступно'}[detail] ?? 'Ошибка связи');
}

export function mountSourceConsole(container,api) {
  container.innerHTML='<section class="panel connector-console"><h2>'+tr('Данные в обзоре')+'</h2>'+
    '<div class="connector-groups">'+groups.map(group=>'<section class="connector-group"><header><h3>'+tr(group.label)+'</h3>'+
      '<label class="check"><input type="checkbox" data-source-toggle="'+group.id+'"'+(sourceEnabled(group.id)?' checked':'')+
      ' aria-label="'+tr('Показывать в обзоре')+' · '+tr(group.label)+'">'+tr('Показывать в обзоре')+'</label></header>'+
      '<ul class="connector-rows">'+group.feeds.map(([id,title,url])=>'<li><div><strong>'+
        (url?'<a href="'+safe(url)+'" target="_blank" rel="noopener noreferrer">'+tr(title)+'</a>':tr(title))+'</strong>'+
        '<p class="caption"'+(id?' data-source-state="'+id+'"':'')+'>'+tr(id?'Связь ещё не проверяли':'Локальная выборка')+'</p></div>'+
        (id?'<button type="button" class="button-quiet" data-source-check="'+id+'" aria-label="'+tr('Проверить связь')+' · '+
          tr(title)+'">'+tr('Проверить связь')+'</button>':'')+'</li>').join('')+'</ul></section>').join('')+
    '</div></section><section class="panel connector-errors"><h2>'+tr('Журнал ошибок')+'</h2><div id="connector-errors"></div></section>'+
    '<p class="caption" id="connector-status" role="status"></p>';
  const status=container.querySelector('#connector-status');
  let lastRevision=0;
  function paint(data) {
    if (!container.isConnected) return;
    for (const [id,result] of Object.entries(data.latest ?? {})) {
      const node=container.querySelector('[data-source-state="'+CSS.escape(id)+'"]');
      if (!node) continue;
      node.textContent=[t(result.status==='ok'?'Доступен':'Ошибка связи'),timestamp(result.checkedAt),
        result.status==='ok' ? t('{time} мс',{time:formatNumber(result.durationMs)}) : message(result.detail)].join(' · ');
      node.dataset.status=result.status;
    }
    const log=container.querySelector('#connector-errors');
    log.innerHTML=data.errors?.length ? '<ul class="connector-rows">'+data.errors.map(event=>'<li><div><strong>'+
      tr(feedNames.get(event.id) ?? event.id)+'</strong><p class="caption">'+safe(message(event.detail))+
      '</p></div><time class="caption" datetime="'+safe(event.checkedAt)+'">'+safe(timestamp(event.checkedAt))+'</time></li>').join('')+'</ul>' :
      '<p class="caption">'+tr('Ошибок проверки пока нет.')+'</p>';
  }
  const revision=lastRevision;
  void api('source-status').then(data=>{
    if (revision===lastRevision) paint(data);
  }).catch(()=>{if (container.isConnected && revision===lastRevision) status.textContent=t('Не удалось получить статус.');});
  container.addEventListener('change',event=>{
    if (event.target.matches('[data-source-toggle]')) setSourceEnabled(event.target.dataset.sourceToggle,event.target.checked);
  });
  container.addEventListener('click',async event=>{
    const button=event.target.closest('[data-source-check]');
    if (!button || button.disabled) return;
    lastRevision++;
    button.disabled=true;
    button.textContent=t('Проверяем…');
    status.textContent='';
    try {paint(await api('source-check',{id:button.dataset.sourceCheck}));}
    catch {if (container.isConnected) status.textContent=t('Не удалось получить статус.');}
    finally {
      if (container.isConnected) {
        button.disabled=false;
        button.textContent=t('Проверить связь');
      }
    }
  });
}
