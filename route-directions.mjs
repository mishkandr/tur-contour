const destinations = {
  Владимир: { en:'Vladimir', cn:'弗拉基米尔' },
  Суздаль: { en:'Suzdal', cn:'苏兹达尔' },
  Кидекша: { en:'Kideksha', cn:'基杰克沙' },
  Муром: { en:'Murom', cn:'穆罗姆' },
  'Гусь-Хрустальный': { en:'Gus-Khrustalny', cn:'古斯-赫鲁斯塔利内' },
  Боголюбово: { en:'Bogolyubovo', cn:'博戈柳博沃' },
};

const formats = ['heritage','museum','any','romantic','family','hike','nature','craft','pilgrimage'];

export const routeDirections = [
  {
    id:'vladimir-suzdal', title:'Владимир и Суздаль', theme:'heritage',
    description:'Белокаменная архитектура и музеи. На третий день можно добавить Кидекшу.',
    centres:['Владимир','Суздаль','Кидекша'],
    themes:formats.slice(0,5), defaults:{size:18,market:'zh',demo:true,days:2},
    translations:{
      en:{title:'Vladimir and Suzdal',description:'White-stone architecture and museums, with Kideksha as a third-day option.'},
      'zh-Hans':{title:'弗拉基米尔与苏兹达尔',description:'参观白石建筑与博物馆，第三天可前往基杰克沙。'},
    },
  },
  {
    id:'murom', title:'Муром на Оке', theme:'pilgrimage',
    description:'Муромский монастырь, исторические коллекции и ночёвка в городе для трёхдневной программы.',
    centres:['Владимир','Муром'],
    themes:['pilgrimage','heritage','museum','family','any'], defaults:{size:8,market:'ru',demo:true,days:3},
    translations:{
      en:{title:'Murom on the Oka',description:'A monastery, historical collections and an overnight stay in Murom on the three-day itinerary.'},
      'zh-Hans':{title:'奥卡河畔的穆罗姆',description:'参观修道院与历史藏品，三日行程可在穆罗姆过夜。'},
    },
  },
  {
    id:'gus', title:'Хрусталь и ремёсла', theme:'craft',
    description:'История стекла во Владимире и Гусь-Хрустальном. На третий день можно добавить краеведческий музей.',
    centres:['Владимир','Гусь-Хрустальный'],
    themes:['craft','museum','family','any'], defaults:{size:8,market:'ru',demo:true,days:2},
    translations:{
      en:{title:'Crystal and craftsmanship',description:'Glassmaking history in Vladimir and Gus-Khrustalny, with a local history museum as a third-day option.'},
      'zh-Hans':{title:'水晶与传统工艺',description:'了解弗拉基米尔与古斯-赫鲁斯塔利内的玻璃工艺，第三天可参观地方历史博物馆。'},
    },
  },
  {
    id:'bogolyubovo', title:'Пешком вдоль Нерли', theme:'hike',
    description:'Боголюбовский луг и внешний осмотр храма. Программа зависит от состояния тропы.',
    centres:['Владимир','Боголюбово'],
    themes:['hike','nature','heritage','romantic','any'], defaults:{size:8,market:'ru',demo:true,days:2},
    translations:{
      en:{title:'Walking by the Nerl',description:'The Bogolyubovo meadow and a view of the church exterior, subject to trail conditions.'},
      'zh-Hans':{title:'内尔利河畔徒步',description:'前往博戈柳博沃草甸并从外部参观教堂，具体行程取决于步道状况。'},
    },
  },
];

export function directionId(value) {
  return routeDirections.find(({id})=>id===value)?.id ?? 'vladimir-suzdal';
}

export function routeTheme(value,direction) {
  const option = routeDirections.find(({id})=>id===direction);
  // Existing links and saved programmes can request a format outside the advertised pilot formats.
  const supported = direction==='vladimir-suzdal' ? formats : option.themes;
  return supported.includes(value) ? value : option.theme;
}

export function transfer(from,to,start,minutes) {
  return { from,to,start,minutes, name:from+' → '+to,
    cn:destinations[from].cn+' → '+destinations[to].cn, en:destinations[from].en+' → '+destinations[to].en };
}

const regionalPlans = {
  murom: [
    { city:'Владимир', start:600 },
    { city:'Муром', start:700, inbound:transfer('Владимир','Муром',510,170), visits:['murom-monastery','murom-exhibit'] },
    { city:'Муром', start:600, visits:['murom-gallery'], visitCount:1 },
  ],
  gus: [
    { city:'Владимир', start:600 },
    { city:'Гусь-Хрустальный', start:625, inbound:transfer('Владимир','Гусь-Хрустальный',540,70), visits:['maltsov-crystal','gus-history'] },
    { city:'Гусь-Хрустальный', start:600, visits:['gus-history'], visitCount:1 },
  ],
  bogolyubovo: [
    { city:'Владимир', start:600, visits:['dmitrovsky','assumption','history','palaty'] },
    { city:'Боголюбово', start:590, inbound:transfer('Владимир','Боголюбово',540,35),
      mealCity:'Владимир', stayCity:'Владимир', beforeLunch:transfer('Боголюбово','Владимир',null,35), visitsFirst:true,
      visits:['nerl-trail','bogolyubovo'] },
    { city:'Владимир', start:600, visits:['vladimir-glass','stoletov','golden-gate'], visitCount:1 },
  ],
};

export function scheduleFor(settings) {
  if (!Object.hasOwn(regionalPlans,settings.direction)) return null;
  const directions = regionalPlans[settings.direction];
  return directions.slice(0,settings.days).map((day,index)=>{
    const visits = settings.direction==='gus' && index===1 && settings.days===3 ? ['maltsov-crystal'] : day.visits;
    return {...day,...destinations[day.city],visits,visitCount:visits?.length===1 ? 1 : day.visitCount};
  });
}
