const cities = {
  Владимир: '弗拉基米尔',
  Суздаль: '苏兹达尔',
  Кидекша: '基杰克沙',
};

const stopTypes = {
  visit: '参观',
  food: '团体用餐',
  stay: '住宿和入住',
  travel: '交通（预计时间）',
};

const themes = {
  heritage: '历史与建筑', museum: '博物馆', romantic: '浪漫旅行', family: '亲子旅行',
  hike: '徒步', nature: '自然风光', craft:'工艺与玻璃制作', pilgrimage:'朝圣与修道院', any: '不限主题',
};

const missingItems = {
  'Подтверждённая точка посещения': '首个参观点的接待条件',
  'Вторая точка посещения': '第二个参观点的接待条件',
  'Место для обеда': '团体午餐地点',
  Ночёвка: '住宿安排',
};

const dateFormat = new Intl.DateTimeFormat('zh-CN',{
  year:'numeric',month:'long',day:'numeric',timeZone:'Europe/Moscow',
});

function localizeStop(stop, settings) {
  const details = [];
  if (Number.isFinite(stop.capacity)) details.push('场馆接待上限：'+stop.capacity+' 人');
  if (stop.split) {
    details.push('分两场，每组最多 '+Math.ceil(settings.size / 2)+' 人。须与场馆确认两个时段和等候安排。');
  }
  if (!settings.demo && stop.booking === 'reservation') details.push('须预约，请向供应方确认预约是否成功。');
  return {
    time:stop.start+'–'+stop.end,
    category:stopTypes[stop.type] ?? '行程项目',
    name:stop.cn || stop.name,
    originalName:stop.cn ? stop.name : null,
    details,
    source:stop.sourceUrl ?? stop.url,
  };
}

export function chineseItinerary(plan) {
  if (plan.settings.market !== 'zh') return null;
  const {settings} = plan;
  const preparation = [
    '确认中文导游或随团中文翻译，以及场馆对翻译服务的要求。',
    '确认团体午餐、餐食偏好和过敏信息，以及酒店的客房余量、房型和入住安排。',
    '与承运方确认车辆、上下车地点和实际行车时间。',
    '与供应方确认团体接待名额、门票、参观时段和预约。',
  ];
  if (settings.access) preparation.push('确认场馆和车辆的无障碍通行条件。');
  if (settings.theme === 'family') preparation.push('确认年龄限制和亲子服务。');
  if (plan.themeNote && ['hike','nature'].includes(settings.theme)) preparation.push('自然景点或徒步线路的接待条件尚待确认。');
  return {
    title:'弗拉基米尔州团队行程',
    group:'中国游客团队 · '+settings.size+' 人 · '+plan.days.length+' 天 · '+(themes[settings.theme] ?? themes.any)+' · 当地时间',
    status:settings.demo ? '演示行程草案。接待条件为演示数据，预订尚未确认。' :
      plan.completeness ? '行程草案。已校验接待条件，交通、实际名额和预订须另行确认。' : '行程草案。部分接待条件尚待确认。',
    preparation,
    days:plan.days.map((day,index)=>({
      title:'第 '+(index+1)+' 天 · '+(day.cn ?? cities[day.city] ?? day.city),
      date:dateFormat.format(new Date(day.date)),
      stops:day.stops.map(stop=>localizeStop(stop,settings)),
      missing:day.missing.map(item=>missingItems[item] ?? '其他行程项目'),
    })),
  };
}

export function chineseItineraryText(itinerary) {
  const days = itinerary.days.map(day=>{
    const stops = day.stops.flatMap(stop=>[
      stop.time+'  '+stop.category+' · '+stop.name,
      ...(stop.originalName ? ['  '+stop.originalName] : []),
      ...stop.details.map(detail=>'  '+detail),
      ...(stop.source ? ['  来源：'+stop.source] : []),
    ]);
    const pending = day.missing.length ? ['待确认：'+day.missing.join('、')] : [];
    return [day.title+' · '+day.date,...stops,...pending].join('\n');
  });
  return [itinerary.title+'\n'+itinerary.group+'\n'+itinerary.status,...days,
    ['出发前请确认',...itinerary.preparation.map(item=>'• '+item)].join('\n'),
  ].join('\n\n')+'\n';
}
