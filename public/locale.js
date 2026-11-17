const localeTags = { ru: 'ru-RU', en: 'en-GB', zh: 'zh-Hans' };
const storageKey = 'tur-contour.locale';
const originalText = new WeakMap();
const originalAttributes = new WeakMap();
const ignored = '[data-source-text], [data-no-localize], script, style, code, pre, textarea';
const localizedAttributes = ['aria-label', 'aria-description', 'alt', 'placeholder', 'title'];
const messages = new Map();

export function addLocaleMessages(rows) {
  for (const [russian, english, chinese] of rows) {
    messages.set(russian, { ru: russian, en: english, zh: chinese });
  }
}

function savedLocale() {
  try {
    const stored = globalThis.localStorage?.getItem(storageKey);
    if (Object.hasOwn(localeTags, stored)) return stored;
  } catch {
    return 'ru';
  }
  return 'ru';
}

let activeLocale = savedLocale();

export function getLocale() {
  return activeLocale;
}

export function setLocale(locale) {
  if (!Object.hasOwn(localeTags, locale)) return activeLocale;
  activeLocale = locale;
  try {
    globalThis.localStorage?.setItem(storageKey, locale);
  } catch {
    // The active tab can still switch languages when browser storage is unavailable.
  }
  if (globalThis.document) document.documentElement.lang = localeTag();
  return activeLocale;
}

export function localeTag() {
  return localeTags[activeLocale];
}

export function t(russian, values) {
  const translated = messages.get(russian)?.[activeLocale] ?? russian;
  if (!values) return translated;
  return translated.replace(/\{([\w]+)\}/g, (token, name) => {
    return Object.hasOwn(values, name) ? String(values[name]) : token;
  });
}

export function formatNumber(value, options) {
  return new Intl.NumberFormat(localeTag(), options).format(value);
}

export function formatDate(value, options = { dateStyle: 'medium' }) {
  return new Intl.DateTimeFormat(localeTag(), { timeZone: 'Europe/Moscow', ...options }).format(new Date(value));
}

function localized(value, previous) {
  const original = previous?.result === value ? previous.original : value;
  const key = original.trim();
  if (!key) return { original, result: original };
  const translated = t(key);
  return { original, result: translated === key ? original : original.replace(key, () => translated) };
}

function isExcluded(element) {
  if (!element) return false;
  if (element.closest(ignored)) return true;
  const language = element.closest('[lang]');
  return Boolean(language && language !== element.ownerDocument.documentElement);
}

export function localizeDom(root) {
  if (!root || isExcluded(root.nodeType === 1 ? root : root.parentElement)) return;
  function visit(node) {
    if (node.nodeType === 3) {
      const value = localized(node.data, originalText.get(node));
      originalText.set(node, value);
      if (value.result !== node.data) node.data = value.result;
      return;
    }
    if (node.nodeType === 1) {
      if (node.matches(ignored) || node.hasAttribute('lang') && node !== node.ownerDocument.documentElement) return;
      const previous = originalAttributes.get(node) ?? new Map();
      for (const name of localizedAttributes) {
        const attribute = node.getAttribute(name);
        if (attribute === null) {
          previous.delete(name);
          continue;
        }
        const value = localized(attribute, previous.get(name));
        previous.set(name, value);
        if (value.result !== attribute) node.setAttribute(name, value.result);
      }
      if (previous.size) originalAttributes.set(node, previous);
    }
    for (const child of node.childNodes) visit(child);
  }
  visit(root);
}

addLocaleMessages([
  ['ТурКонтур', 'TourContour', '旅域监测'],
  ['ТурКонтур, мониторинг', 'TourContour monitoring', '旅域监测工作台'],
  ['ТурКонтур — мониторинг маршрутов', 'TourContour — route monitoring', '旅域监测 · 线路监测'],
  ['К содержанию', 'Skip to content', '跳转到主要内容'],
  ['Разделы', 'Main navigation', '主导航'],
  ['Карта', 'Map', '地图'],
  ['Карта маршрутов', 'Route map', '线路地图'],
  ['Интерактивная карта Владимирской области', 'Interactive map of Vladimir Oblast', '弗拉基米尔州交互地图'],
  ['Каталог', 'Catalogue', '名录'],
  ['Объекты', 'Sites', '文旅点位'],
  ['Маршрут', 'Itinerary', '行程'],
  ['Маршруты', 'Itineraries', '行程'],
  ['Статистика', 'Statistics', '统计'],
  ['Источники', 'Sources', '数据来源'],
  ['Данные и методика', 'Data and methodology', '数据与方法'],
  ['Данные и методика ↗', 'Data and methodology ↗', '数据与方法 ↗'],
  ['Загружаем мониторинг…', 'Loading monitoring data…', '正在加载监测数据…'],
  ['Мониторинг изменений туристических объектов и маршрутов Владимирской области.', 'Monitoring changes to tourism sites and itineraries in Vladimir Oblast.', '监测弗拉基米尔州文旅点位和行程的变动。'],
  ['Владимирская область', 'Vladimir Oblast', '弗拉基米尔州'],
  ['Владимир', 'Vladimir', '弗拉基米尔'],
  ['Суздаль', 'Suzdal', '苏兹达尔'],
  ['Кидекша', 'Kideksha', '基杰克沙'],
  ['Владимир · Суздаль · Кидекша', 'Vladimir · Suzdal · Kideksha', '弗拉基米尔 · 苏兹达尔 · 基杰克沙'],
  ['Язык интерфейса', 'Interface language', '界面语言'],
  ['Объект', 'Site', '点位'],
  ['Достопримечательность', 'Attraction', '景点'],
  ['Посещение', 'Visit', '参观'],
  ['Питание', 'Dining', '餐饮'],
  ['Размещение', 'Accommodation', '住宿'],
  ['Владимирская область · программы на два или три дня', 'Vladimir Oblast · two- or three-day itineraries', '弗拉基米尔州 · 两至三日行程'],
  ['Подходит по условиям', 'Meets requirements', '符合条件'],
  ['Ограничение', 'Restriction', '限制条件'],
  ['Есть ограничение', 'Restriction applies', '存在限制'],
  ['Требует проверки', 'Needs verification', '有待核实'],
  ['Требуется проверка', 'Needs verification', '有待核实'],
  ['Нужна проверка', 'Needs verification', '有待核实'],
  ['Нужно уточнить', 'Needs confirmation', '尚待确认'],
  ['Требует подтверждения', 'Needs confirmation', '尚待确认'],
  ['Требует проверки или изменений', 'Needs verification or revision', '需要核实或调整'],
  ['Закрыто по графику', 'Closed according to schedule', '按日程闭馆'],
  ['График не найден', 'Schedule not found', '未找到开放时间'],
  ['График не покрывает дату', 'Schedule does not cover this date', '已发布的日程未覆盖所选日期'],
  ['Дату нужно сверить', 'Check availability on this date', '需核实所选日期'],
  ['Подходит в демо', 'Meets demo requirements', '符合演示条件'],
  ['Условия подтверждены', 'Requirements confirmed', '条件已确认'],
  ['Проходит учебную проверку', 'Passes the demo check', '通过演示核验'],
  ['Проходит проверку', 'Passes the check', '通过核验'],
  ['История и архитектура', 'History and architecture', '历史与建筑'],
  ['Музеи', 'Museums', '博物馆'],
  ['Романтическая поездка', 'Couples’ trip', '情侣出游'],
  ['Семейная поездка', 'Family trip', '家庭出游'],
  ['Пеший маршрут', 'Walking itinerary', '徒步行程'],
  ['Природа', 'Nature', '自然风光'],
  ['Любой формат', 'Any format', '所有类型'],
  ['ещё не проверен', 'Not checked yet', '尚未核实'],
  ['нет данных', 'No data', '暂无数据'],
  ['Нет данных', 'No data', '暂无数据'],
  ['Действие не выполнено', 'Action could not be completed', '操作未完成'],
  ['тыс.', 'k', '千'],
  ['Среднее по месяцам,', 'Monthly average,', '各月平均值，'],
  ['. Тёмным выделены три месяца с наименьшими значениями.', '. The three months with the lowest values are highlighted.', '。深色标出数值最低的三个月。'],
  ['Значения по месяцам', 'Monthly values', '各月数值'],
  ['Месяц', 'Month', '月份'],
  ['Подходящих объектов нет.', 'No sites match your filters.', '没有符合筛选条件的点位。'],
  ['Условия визита', 'Visit requirements', '到访条件'],
  ['Страница объекта', 'Site website', '点位官网'],
  ['Каталог объектов', 'Site catalogue', '文旅点位名录'],
  ['Опубликованные условия для группы из', 'Published requirements for a group of', '已发布的团体到访条件，团体人数为'],
  ['чел. · Владимир, Суздаль и Кидекша в последовательные дни', 'people · Vladimir, Suzdal and Kideksha on consecutive days', '人 · 按天依次到访弗拉基米尔、苏兹达尔和基杰克沙'],
  ['Название или город', 'Name or city', '名称或城市'],
  ['Дата начала', 'Start date', '开始日期'],
  ['Поиск', 'Search', '搜索'],
  ['Категория', 'Category', '类别'],
  ['Все категории', 'All categories', '所有类别'],
  ['Готовность', 'Readiness', '接待准备情况'],
  ['Любой статус', 'Any status', '所有状态'],
  ['Место и дата', 'Place and date', '地点与日期'],
  ['Опубликованный график', 'Published schedule', '已发布的开放时间'],
  ['Источник', 'Source', '来源'],
  ['Опубликованные условия', 'Published requirements', '已发布的接待条件'],
  ['· группа', '· group of', '· 团体人数'],
  ['чел.', 'people', '人'],
  ['чел. ·', 'people ·', '人 ·'],
  ['В собранных источниках нет условий визита. Уточните часы, запись и допустимый размер группы у объекта.', 'Visit requirements are missing from the collected sources. Ask the site about opening hours, booking and group limits.', '当前来源未提供到访条件。请向点位确认开放时间、预约和团体人数上限。'],
  ['Последний вход', 'Last admission', '最晚入场时间'],
  ['Период действия', 'Validity period', '有效期'],
  ['с', 'from', '自'],
  ['по', 'to', '至'],
  ['Уточнить у объекта', 'Verify with the site', '向点位核实'],
  ['График', 'Schedule', '开放时间'],
  ['Правила записи', 'Booking rules', '预约规则'],
  ['Лимиты отдельных посещений', 'Limits for specific visits', '特定场次的人数限制'],
  ['Другие сведения', 'Other details', '其他信息'],
  ['Сверено с опубликованными источниками', 'Checked against published sources', '已与公开来源核对'],
  ['· Наличие мест на дату визита проверяется отдельно.', '· Check availability for the visit date separately.', '· 所选日期的余位须另行确认。'],
  ['Закрыть', 'Close', '关闭'],
  ['Источник сведений об объекте', 'Source of site information', '点位信息来源'],
  ['Дата проверки', 'Checked on', '核对日期'],
  ['Координаты', 'Coordinates', '坐标'],
  ['Координаты ↗', 'Coordinates ↗', '坐标 ↗'],
  ['Учебный режим', 'Demo mode', '演示模式'],
  ['Экспертное подтверждение', 'Verified by an expert', '专家确认'],
  ['Учебный аудит, версия', 'Demo audit, version', '演示核验版本'],
  ['Учебный аудит, версия {version}', 'Demo audit, version {version}', '演示核验版本 {version}'],
  ['Источник подтверждённых условий', 'Source of verified requirements', '已核实条件的来源'],
  ['Проверено', 'Verified', '已核实'],
  ['Действует до', 'Valid until', '有效期至'],
  ['Запись', 'Booking', '预约'],
  ['Нужно бронирование', 'Booking required', '需要预约'],
  ['Предварительная запись не требуется', 'Advance booking is optional', '无需提前预约'],
  ['Лимит группы', 'Group limit', '团体人数上限'],
  ['Часы работы', 'Opening hours', '开放时间'],
  ['Продолжительность', 'Duration', '时长'],
  ['мин.', 'min', '分钟'],
  ['Под перевод', 'Interpreting arrangements', '口译安排'],
  ['Предусмотрено в демо', 'Included in the demo', '演示条件中已安排'],
  ['Подтверждено источником', 'Confirmed by source', '已由来源确认'],
  ['Проверка для двух подгрупп. Согласуйте оба сеанса с музеем.', 'Check applies to two subgroups. Confirm both sessions with the museum.', '核验适用于两个小组。请与博物馆确认两场参观。'],
  ['День', 'Day', '第几天'],
  ['День {day}', 'Day {day}', '第{day}天'],
  ['Переезд', 'Transfer', '交通转移'],
  ['Переезд · расчётное время', 'Transfer · estimated time', '交通转移 · 预计用时'],
  ['· два сеанса по', '· two sessions of', '· 分两场，每场'],
  ['· лимит', '· limit', '· 上限'],
  ['в демо', 'in demo', '演示条件'],
  ['Требуется подтверждение:', 'Needs confirmation:', '待确认事项：'],
  ['Есть пробелы', 'Information gaps', '信息不全'],
  ['Согласуйте два сеанса', 'Confirm two sessions', '请确认两场参观'],
  ['· два сеанса', '· two sessions', '· 分两场参观'],
  ['Точки требуют уточнения', 'Stops need confirmation', '行程点位需要确认'],
  ['Варианты программы', 'Itinerary options', '行程方案'],
  ['Проверяем расписание и условия объектов…', 'Checking schedules and site requirements…', '正在核对日程和点位条件…'],
  ['Повторить расчёт', 'Recalculate', '重新计算'],
  ['На эти даты варианты не найдены. Измените параметры программы или уточните данные объектов.', 'No options were found for these dates. Change the itinerary settings or verify the site data.', '这些日期暂无可用方案。请调整行程条件或核实点位信息。'],
  ['Сравнение с ИИ', 'AI comparison', 'AI 方案对比'],
  ['ИИ оценивает, какой вариант лучше сохраняет замысел программы. Расписание и лимиты проверяет сервис.', 'AI assesses which option suits the itinerary’s intent. The service checks schedules and limits.', 'AI 判断哪个方案更符合行程设想。开放时间和人数上限由系统核验。'],
  ['Что важно сохранить', 'What should the itinerary keep?', '行程中哪些内容需要保留？'],
  ['Необязательно', 'Optional', '选填'],
  ['Например, сохранить знакомство с архитектурой Суздаля', 'For example, keep a visit focused on Suzdal’s architecture', '例如，保留了解苏兹达尔建筑的安排'],
  ['Сравниваем…', 'Comparing…', '正在对比…'],
  ['Сравнить варианты с ИИ', 'Compare options with AI', '用 AI 对比方案'],
  ['Для сравнения нужны два варианта, прошедших проверку.', 'The comparison needs two options that passed the check.', '对比需要两个通过核验的方案。'],
  ['Готовим подсказку…', 'Preparing a suggestion…', '正在生成建议…'],
  ['Согласуйте два отдельных сеанса с музеем.', 'Confirm the two separate sessions with the museum.', '请与博物馆确认两场独立的参观。'],
  ['дня ·', 'days ·', '天 ·'],
  ['· Группа из Китая', '· Group from China', '· 中国团队'],
  ['Решение сохранено', 'Decision saved', '决定已保存'],
  ['Решение специалиста', 'Specialist’s decision', '工作人员的决定'],
  ['Согласование в рамках пилота. Подтверждение визитов остаётся за поставщиками.', 'Approval is part of the pilot. Providers still need to confirm each visit.', '此审定仅用于试点演示。实际到访仍需服务方确认。'],
  ['Согласование записывает эту версию программы в журнал. Подтвердите бронирование у поставщиков.', 'Approval saves this itinerary version in the journal. Confirm bookings with the providers.', '审定后会将此行程版本写入记录。请向服务方确认预约。'],
  ['Согласовано', 'Approved', '已审定'],
  ['Согласовать вариант', 'Approve this option', '审定此方案'],
  ['Требуют внимания', 'Need attention', '需关注'],
  ['из', 'of', '/'],
  ['В каталоге пока нет объектов для этого дня.', 'There are no catalogue sites for this day yet.', '名录中暂无适合这一天的点位。'],
  ['Проверка условий на даты поездки', 'Check requirements for travel dates', '核对行程日期的接待条件'],
  ['Откройте объект, чтобы сверить опубликованный график, правила записи и вопросы для поставщика.', 'Open a site to check published hours, booking rules and questions for the provider.', '打开点位可核对已发布的开放时间、预约规则和待向服务方确认的问题。'],
  ['Программа на китайском', 'Itinerary in Chinese', '中文行程'],
  ['Скачать программу (.txt)', 'Download itinerary (.txt)', '下载行程（.txt）'],
  ['Скачать программу на китайском (.txt)', 'Download Chinese itinerary (.txt)', '下载中文行程（.txt）'],
  ['Журнал решений', 'Decision journal', '决策记录'],
  ['Учебная программа', 'Demo itinerary', '演示行程'],
  ['Рабочая программа', 'Working itinerary', '实际工作行程'],
  ['Здесь появятся версии программ, согласованные специалистом.', 'Itinerary versions approved by a specialist will appear here.', '此处显示由工作人员审定的行程版本。'],
  ['Планирование маршрута', 'Itinerary planning', '行程规划'],
  ['Параметры', 'Settings', '行程条件'],
  ['Длительность', 'Duration', '时长'],
  ['2 дня', '2 days', '2 天'],
  ['3 дня', '3 days', '3 天'],
  ['Группа', 'Group', '团体'],
  ['Размер группы', 'Group size', '团体人数'],
  ['Группа из Китая', 'Group from China', '中国团队'],
  ['Российская группа', 'Group from Russia', '俄罗斯团队'],
  ['Малая группа', 'Small group', '小型团队'],
  ['Формат поездки', 'Trip format', '行程类型'],
  ['Безбарьерный доступ', 'Step-free access', '无障碍通行'],
  ['Учебные условия визита', 'Use demo visit requirements', '使用演示接待条件'],
  ['Рассчитать варианты', 'Calculate options', '计算可选方案'],
  ['Пересчитайте варианты с новыми параметрами.', 'Recalculate options with the new settings.', '请按新条件重新计算方案。'],
  ['Согласованная программа сохранена.', 'Approved itinerary saved.', '已保存审定后的行程。'],
  ['Обновлено из источника', 'Updated from source', '已从来源更新'],
  ['Последний доступный снимок', 'Last available snapshot', '最近可用的快照'],
  ['Начальный снимок', 'Initial snapshot', '初始快照'],
  ['Проверка источника:', 'Source check:', '来源核查：'],
  ['Ряд Roschart', 'Roschart time series', 'Roschart 时间序列'],
  ['Первоисточник Росстат', 'Rosstat primary source', '原始来源：俄罗斯联邦统计局'],
  ['· Данные получены', '· Data retrieved', '· 数据获取时间'],
  ['Открыть', 'Open', '打开'],
  ['Открыть мониторинг', 'Open monitoring', '打开监测工作台'],
  ['Открыть маршрут', 'Open itinerary', '打开行程'],
  ['Сезонность размещения', 'Seasonality of accommodation', '住宿季节变化'],
  ['Владимирская область · месячные ряды Росстата', 'Vladimir Oblast · monthly Rosstat time series', '弗拉基米尔州 · 俄罗斯联邦统计局月度数据'],
  ['Обновить источники', 'Refresh sources', '更新数据来源'],
  ['Средние по полным календарным годам', 'Averages across full calendar years', '完整自然年的平均值'],
  ['Показатель', 'Indicator', '统计指标'],
  ['Ночёвки', 'Overnight stays', '住宿人夜数'],
  ['Размещённые лица', 'Guests accommodated', '接待住宿人数'],
  ['Росстат', 'Rosstat', '俄罗斯联邦统计局'],
  ['Выгрузка через Roschart', 'Export via Roschart', '通过 Roschart 获取'],
  ['Запрос к агенту', 'Query for the assistant', '向助手提出的问题'],
  ['Например, когда меньше ночёвок?', 'For example, when are there fewer overnight stays?', '例如，哪些月份的住宿人夜数较少？'],
  ['Запросить анализ', 'Request analysis', '请求分析'],
  ['Спросить', 'Ask', '提问'],
  ['Минимум ночёвок за три года', 'Fewest overnight stays over three years', '近三年住宿人夜数最低的月份'],
  ['Какие маршруты затронуты', 'Which itineraries are affected?', '哪些行程受到影响？'],
  ['Предложения размещения', 'Accommodation offers', '住宿报价'],
  ['Учебные данные', 'Demo data', '演示数据'],
  ['Сопоставляем две учебные выгрузки OTA по дате заезда. Для группы свободные номера и условия нужно подтвердить у отеля.', 'Compare two demo accommodation feeds by check-in date. Verify room availability and group terms with the hotel.', '按入住日期比较两份演示住宿数据。团体的空房和接待条件须向酒店确认。'],
  ['Дата заезда', 'Check-in date', '入住日期'],
  ['Гостей в номере', 'Guests per room', '每间房入住人数'],
  ['1 гость', '1 guest', '1 位住客'],
  ['2 гостя', '2 guests', '2 位住客'],
  ['Сравнить предложения', 'Compare offers', '比较报价'],
  ['₽ за ночь ·', 'RUB per night ·', '卢布／夜 ·'],
  ['ном. в выгрузке', 'rooms in feed', '房间（来源记录）'],
  ['На эту дату и состав номера в учебных выгрузках нет данных.', 'The demo feeds have no data for this date and occupancy.', '演示数据未覆盖此日期和入住人数。'],
  ['Выгрузки покрывают сценарий 21–22 ноября 2026 года.', 'The feeds cover the scenario for 21–22 November 2026.', '数据覆盖 2026 年 11 月 21 日至 22 日的演示场景。'],
  ['Открыть учебные выгрузки', 'Open demo feeds', '查看演示数据源'],
  ['· Данные об отелях учитываются по объектам каталога.', '· Hotel data are matched to catalogue sites.', '· 将酒店数据与名录中的点位匹配。'],
  ['Ночёвки · Росстат через Roschart', 'Overnight stays · Rosstat via Roschart', '住宿人夜数 · 来自俄罗斯联邦统计局，经 Roschart 获取'],
  ['Размещённые лица · Росстат через Roschart', 'Guests accommodated · Rosstat via Roschart', '接待住宿人数 · 来自俄罗斯联邦统计局，经 Roschart 获取'],
  ['Названия и координаты · Wikidata', 'Names and coordinates · Wikidata', '名称和坐标 · 维基数据'],
  ['Подключён', 'Connected', '已连接'],
  ['Последняя копия', 'Last available copy', '最近可用的副本'],
  ['Подключена', 'Connected', '已连接'],
  ['Ошибка обновления', 'Refresh failed', '更新失败'],
  ['Ожидает проверки', 'Awaiting verification', '等待核查'],
  ['Источники и изменения', 'Sources and changes', '来源与变动'],
  ['Автоматическая проверка при запуске и раз в 6 часов работы приложения.', 'Sources are checked at startup and every six hours while the application is running.', '应用启动时自动核查数据来源，运行期间每 6 小时核查一次。'],
  ['Журнал изменений', 'Change log', '变动记录'],
  ['Учебное изменение', 'Demo change', '演示变动'],
  ['Из внешнего источника', 'From an external source', '来自外部来源'],
  ['Изменений не зафиксировано.', 'No changes recorded.', '未记录到变动。'],
  ['Автоматические подключения', 'Connected feeds', '自动接入的数据源'],
  ['Выгрузка условий визита', 'Visit requirements feed', '到访条件数据源'],
  ['Снимок от', 'Snapshot from', '快照日期'],
  ['· объектов:', '· sites:', '· 点位数：'],
  ['Ожидаем доступный снимок с подтверждёнными условиями.', 'Waiting for a snapshot with verified requirements.', '等待包含已核实接待条件的数据快照。'],
  ['Нет подключённой выгрузки с подтверждёнными условиями.', 'No verified requirements feed is connected.', '尚未接入已核实的接待条件数据。'],
  ['Не подключена', 'Not connected', '未连接'],
  ['Справочные материалы', 'Reference material', '参考资料'],
  ['Опубликованные условия посещения', 'Published visit requirements', '已发布的到访条件'],
  ['Сверены сведения по', 'Information checked for', '已核对点位数：'],
  ['объектам ·', 'sites ·', '·'],
  ['. Снимок собран по страницам музеев, поставщиков и регионального турпортала.', '. The snapshot uses pages from museums, providers and the regional tourism portal.', '。快照来自博物馆、服务方和州旅游门户网站。'],
  ['Ссылки, область действия лимитов и вопросы к поставщику доступны в', 'Links, the scope of limits and questions for providers are in the', '在以下位置可查看链接、人数限制的适用范围和待向服务方确认的问题：'],
  ['каталоге объектов', 'site catalogue', '文旅点位名录'],
  ['Учебный аудит · версия', 'Demo audit · version', '演示核验 · 版本'],
  ['Учебный аудит · версия {version}', 'Demo audit · version {version}', '演示核验 · 版本 {version}'],
  ['Учебный аудит', 'Demo audit', '演示核验'],
  ['Сценарные лимиты, режим работы и условия для групп.', 'Scenario-specific limits, opening hours and group requirements.', '演示场景中的人数限制、开放时间和团体接待条件。'],
  ['Материалы МАГ', 'MAG case materials', '国际酒店业学院案例资料'],
  ['Диагностические критерии и контрольные объекты использованы для сверки. Первичные материалы доступны участникам кейса на доске.', 'Diagnostic criteria and reference sites were used for cross-checking. Case participants can access the original materials on the board.', '核对时采用了诊断标准和参照点位。案例参与者可在协作看板查看原始资料。'],
  ['Анализ…', 'Analysing…', '正在分析…'],
  ['Проверяем источники…', 'Checking sources…', '正在核查数据来源…'],
  ['Обновлено', 'Updated', '已更新'],
  ['Обновлено {count} источников.', 'Sources updated: {count}.', '已更新 {count} 个数据来源。'],
  ['источников.', 'sources.', '个数据来源。'],
  ['Выгрузку условий визита проверить не удалось.', 'Could not check the visit requirements feed.', '未能核查到访条件的数据源。'],
  ['Лимит обновлён. Программы пересчитаны.', 'Limit updated. Itineraries recalculated.', '人数上限已更新，行程已重新计算。'],
  ['Восстановлены исходные учебные условия.', 'Original demo requirements restored.', '已恢复初始演示条件。'],
  ['Точки маршрута', 'Itinerary stops', '行程点位'],
  ['Все объекты', 'All sites', '所有点位'],
  ['Ограничения', 'Restrictions', '限制条件'],
  ['Официальные графики', 'Official schedules', '官方开放时间'],
  ['Карта объектов и остановок', 'Map of sites and stops', '点位与停留点地图'],
  ['Дни маршрута', 'Itinerary days', '行程日期'],
  ['Управление картой', 'Map controls', '地图控制'],
  ['Показать маршрут целиком', 'Show full itinerary', '显示完整线路'],
  ['Развернуть карту', 'Expand map', '展开地图'],
  ['Объекты на карте', 'Sites on the map', '地图上的点位'],
  ['Выбранная программа', 'Selected itinerary', '选中的行程'],
  ['Проверьте готовность поездок и сравните, как изменения влияют на программу.', 'Check itinerary readiness and compare how changes affect the schedule.', '核对行程的准备情况，并比较变动对日程的影响。'],
  ['Сравнить улучшения', 'Compare improvements', '比较改进措施'],
  ['Другой вариант', 'Alternative option', '备选方案'],
  ['Схема поездки', 'Itinerary diagram', '行程示意图'],
  ['Улицы недоступны · схема поездки', 'Street tiles unavailable · itinerary diagram', '街道底图不可用 · 已显示行程示意图'],
  ['Загружаем улицы…', 'Loading street tiles…', '正在加载街道底图…'],
  ['Карта улиц', 'Street map', '街道地图'],
  ['В программе двумя сеансами', 'Scheduled as two sessions', '已安排两场参观'],
  ['Часы на дату визита', 'Hours on the visit date', '到访日期的开放时间'],
  ['Лимит в демо', 'Demo limit', '演示人数上限'],
  ['Лимит в демо {before} → {after} чел.', 'Demo limit: {before} → {after} people.', '演示人数上限：{before} → {after} 人。'],
  ['Подтверждённый лимит', 'Verified group limit', '已核实的团体人数上限'],
  ['· в программе', '· in the itinerary', '· 已列入行程'],
  ['Лимит изменился. Выберите замену или проверьте, помещаются ли два сеанса в расписание.', 'The limit changed. Choose a replacement or check whether two sessions fit the schedule.', '人数上限已变更。请选择替代点位，或核对日程能否安排两场参观。'],
  ['Закрыть карточку точки', 'Close site details', '关闭点位详情'],
  ['Первоисточник', 'Primary source', '原始来源'],
  ['Первоисточник ↗', 'Primary source ↗', '原始来源 ↗'],
  ['Паспорт объекта', 'Site record', '点位档案'],
  ['Сверка условий', 'Requirements check', '接待条件核对'],
  ['Маршрут под наблюдением', 'Monitored itinerary', '监测中的行程'],
  ['Официальные источники', 'Official sources', '官方来源'],
  ['Учебный сценарий', 'Demo scenario', '演示情景'],
  ['По подтверждённым условиям', 'Based on verified requirements', '依据已核实的条件'],
  ['Замена объекта', 'Replace site', '更换点位'],
  ['Два сеанса', 'Two sessions', '两场参观'],
  ['Кремль остаётся в программе. Два сеанса нужно согласовать с музеем.', 'The Kremlin stays in the itinerary. Confirm both sessions with the museum.', '克里姆林宫继续保留在行程中。请与博物馆确认两场参观。'],
  ['Два сеанса не помещаются в расписание по учебным условиям.', 'The demo schedule has no time for two sessions.', '按演示条件，日程无法安排两场参观。'],
  ['В программу добавлен', 'Added to the itinerary:', '已加入行程：'],
  ['В программу добавлен {site}.', 'Added to the itinerary: {site}.', '已加入行程：{site}。'],
  ['Нужна подтверждённая замена.', 'Find a verified replacement.', '需要已核实的替代点位。'],
  ['Варианты корректировки', 'Revision options', '调整方案'],
  ['Откройте программу и сравните доступные варианты.', 'Open the itinerary and compare available options.', '打开行程，比较可用方案。'],
  ['Программа требует пересмотра', 'Itinerary needs review', '行程需要复核'],
  ['Выберите объект на карте, чтобы сверить расписание и условия группы на дату визита.', 'Select a site on the map to check opening hours and group requirements for the visit date.', '选择地图上的点位，核对到访当日的开放时间与团体接待条件。'],
  ['Суздальский кремль со стороны реки Каменки, зимой', 'Suzdal Kremlin in winter, viewed from the Kamenka River', '冬季从卡缅卡河一侧看到的苏兹达尔克里姆林宫'],
  ['А. Савин, Википедия ↗', 'A. Savin, Wikipedia ↗', 'A. Savin，维基百科 ↗'],
  ['Точки для сверки', 'Sites to check', '待核对的点位'],
  ['Точки программы', 'Itinerary stops', '行程停留点'],
  ['в плане', 'in itinerary', '个已规划'],
  ['Пока нет точек на выбранный день.', 'There are no stops for the selected day yet.', '所选日暂未安排停留点。'],
  ['Проверить условия программы', 'Check itinerary requirements', '核对行程条件'],
  ['Открыть программу', 'Open itinerary', '打开行程'],
  ['Выбрать группу', 'Select a group', '选择团体'],
  ['Изменений пока нет', 'No changes yet', '暂无变动'],
  ['Запустите учебное обновление', 'Run the demo update', '运行演示更新'],
  ['в среднем за месяц ↗', 'per month on average ↗', '月平均值 ↗'],
  ['Открыть статистику', 'Open statistics', '打开统计'],
  ['Требуют пересмотра', 'Need review', '需要复核'],
  ['Маршруты под наблюдением', 'Monitored itineraries', '监测中的行程'],
  ['Последнее изменение', 'Latest change', '最近一次变动'],
  ['Минимум ночёвок', 'Fewest overnight stays', '最低住宿人夜数'],
  ['Выполнима', 'Feasible', '可执行'],
  ['Рабочие программы', 'Working itineraries', '实际工作行程'],
  ['Учебные программы', 'Demo itineraries', '演示行程'],
  ['Учебные', 'Demo', '演示'],
  ['Рабочие', 'Working', '实际工作'],
  ['Набор сравниваемых программ', 'Set of itineraries compared', '对比的行程范围'],
  ['Сейчас', 'Now', '当前'],
  ['В сценарии', 'In scenario', '情景结果'],
  ['Какие улучшения помогут', 'Which improvements would help?', '哪些措施有助于改善？'],
  ['· Сравниваем один и тот же набор дат и групп.', '· The same set of dates and groups is used for comparison.', '· 比较基于相同日期与团体。'],
  ['выполнимы сейчас', 'currently feasible', '当前可执行'],
  ['Варианты улучшения', 'Improvement options', '备选改进措施'],
  ['программ в этом сценарии', 'itineraries in this scenario', '个行程在此情景中可执行'],
  ['Результаты по программам', 'Results by itinerary', '各行程结果'],
  ['Расчёт отражает выполнимость наблюдаемых программ при указанных условиях. Наличие мест и запуск поездки подтверждает специалист.', 'The calculation assesses monitored itineraries under the stated requirements. A specialist confirms availability and whether the trip can go ahead.', '计算评估监测行程在给定条件下的可执行性。余位和实际出行由工作人员确认。'],
  ['Снизить лимит в демо', 'Lower the demo limit', '降低演示人数上限'],
  ['Вернуть исходный лимит', 'Restore the original limit', '恢复初始人数上限'],
  ['Весь маршрут', 'Entire itinerary', '完整行程'],
  ['Схема', 'Diagram', '示意图'],
  ['Улицы', 'Streets', '街道底图'],
  ['Карта недоступна. Программа и карточки объектов доступны справа.', 'The map is unavailable. Use the itinerary and site records alongside it.', '地图暂不可用。仍可查看旁边的行程和点位档案。'],
  ['Приблизить', 'Zoom in', '放大'],
  ['Отдалить', 'Zoom out', '缩小'],
  ['Объекты в локации «{city}» · {count}', 'Sites in {city} · {count}', '{city}的点位 · {count}'],
  ['Согласовать второй сеанс', 'Arrange a second session', '协调第二场参观'],
  ['Подобрать замену', 'Find a replacement', '寻找替代点位'],
  ['Восстановить вместимость', 'Restore capacity', '恢复接待容量'],
  ['Среднее по месяцам за {years}. Тёмным выделены три месяца с наименьшими значениями.', 'Monthly averages for {years}. The three lowest values are highlighted.', '{years}年各月平均值。最低的三个月以深色显示。'],
  ['ночёвок', 'overnight stays', '人夜'],
  ['{date} · группа {size} чел.', '{date} · group of {size}', '{date} · {size} 人团队'],
  ['{count} чел.', '{count} people', '{count} 人'],
  ['{minutes} мин.', '{minutes} min', '{minutes} 分钟'],
  ['Лимит {limit} чел. для группы из {group}.', '{limit}-person limit for a group of {group}.', '人数上限为 {limit} 人，团队有 {group} 人。'],
  ['Опубликованный лимит для этого посещения — {limit} чел.', 'The published group limit for this visit is {limit}.', '该参观场次已发布的人数上限为 {limit} 人。'],
  ['Последний вход {time}', 'Last admission {time}', '最晚入场时间 {time}'],
  ['с {date}', 'from {date}', '自 {date}'],
  ['по {date}', 'to {date}', '至 {date}'],
  ['Период действия {period}', 'Valid {period}', '有效期 {period}'],
  ['Сверено с опубликованными источниками {date}. Наличие мест на дату визита проверяется отдельно.', 'Checked against published sources on {date}. Verify availability separately for the visit date.', '已于 {date} 与公开来源核对。所选日期的余位须另行确认。'],
  ['Название в Wikidata отличается от названия в каталоге. Сверьте идентичность объекта.', 'The Wikidata name differs from the catalogue name. Verify that both refer to the same site.', '维基数据名称与名录名称不一致。请核实是否为同一点位。'],
  ['По опубликованному графику этот формат посещения недоступен на выбранную дату.', 'The published schedule does not offer this visit format on the selected date.', '按已发布的日程，所选日期无法安排此类参观。'],
  ['Нужны подтверждённые часы, условия записи и лимит группы.', 'Confirm opening hours, booking requirements and the group size limit.', '请确认开放时间、预约要求和团体人数上限。'],
  ['Подтверждение условий не покрывает выбранную дату визита.', 'Verified requirements do not cover the selected date.', '已核实的接待条件未覆盖所选日期。'],
  ['Безбарьерный доступ недоступен.', 'Step-free access is unavailable.', '无法提供无障碍通行。'],
  ['Длительность визита не помещается в подтверждённые часы и опубликованный график.', 'The visit duration does not fit the verified opening hours and published schedule.', '参观时长超出已核实开放时间和公开日程允许的范围。'],
  ['Работа с китайскоязычным переводчиком требует подтверждения.', 'Confirm the arrangements for a Chinese-speaking interpreter.', '中文口译安排仍需确认。'],
  ['Безбарьерный доступ требует подтверждения.', 'Confirm step-free access.', '无障碍通行条件仍需确认。'],
  ['Проверка источника: {time}', 'Source checked: {time}', '来源核查时间：{time}'],
  ['Данные получены {time}', 'Data retrieved {time}', '数据获取时间 {time}'],
  ['Спросить ИИ по статистике', 'Ask AI about the statistics', '向 AI 查询统计数据'],
  ['Ночёвки и размещённые лица во Владимирской области.', 'Overnight stays and guests accommodated in Vladimir Oblast.', '弗拉基米尔州的住宿人夜数和接待住宿人数。'],
  ['Динамика размещённых лиц за три года', 'Guests accommodated over three years', '近三年接待住宿人数变化'],
  ['Численность размещённых лиц', 'Number of guests accommodated', '接待住宿人数'],
  ['Число ночёвок в средствах размещения', 'Overnight stays at accommodation establishments', '住宿设施接待人夜数'],
  ['Месяцы с наименьшими средними значениями за {years}', 'Months with the lowest averages in {years}', '{years}年平均值最低的月份'],
  ['Исходный ответ на русском', 'Original answer in Russian', '俄语原始回答'],
  ['В подключённой выгрузке нет сопоставимых месячных значений за запрошенный период.', 'The connected feed has no comparable monthly values for the requested period.', '已接入的数据源中没有所请求时段可比的月度数值。'],
  ['Владимирская область, средства размещения. Месячные значения рассчитаны как разности накопительных итогов. Пропуски сохраняются. Для загрузки нужен отдельный показатель.', 'Accommodation establishments in Vladimir Oblast. Monthly values are differences between cumulative totals. Gaps remain in the series. Occupancy requires a separate indicator.', '覆盖弗拉基米尔州住宿设施。月值由累计值作差得出，缺失值予以保留。入住率需另用指标。'],
  ['Базовый разбор', 'Basic parsing', '基础解析'],
  ['Базовый разбор · модель недоступна', 'Basic parsing · model unavailable', '基础解析 · 模型不可用'],
  ['Базовый разбор · модель занята', 'Basic parsing · model busy', '基础解析 · 模型繁忙'],
  ['Qwen · локальная модель', 'Qwen · locally hosted model', 'Qwen · 本地部署模型'],
  ['Проверка доступных показателей', 'Checking available indicators', '核查可用指标'],
  ['Охват данных', 'Data coverage', '数据覆盖范围'],
  ['Для расчёта загрузки нужен фонд доступных мест или номеров за тот же период. Сейчас доступны ряды ночёвок и размещённых лиц по Владимирской области.', 'Occupancy requires the number of available beds or rooms for the same period. Overnight stays and guests accommodated are available for Vladimir Oblast.', '计算入住率需同期可用床位或客房数量。当前可查询弗拉基米尔州的住宿人夜数和接待住宿人数。'],
  ['Подключённые ряды описывают Владимирскую область целиком. Статистики для отдельного города или другого региона в этом источнике нет.', 'The connected series cover Vladimir Oblast as a whole. This source has no values for a single city or another region.', '已接入的数据覆盖整个弗拉基米尔州。此来源不提供单个城市或其他地区的数据。'],
  ['Подключённые ряды охватывают средства размещения Владимирской области. По ним можно сравнить ночёвки и размещённых лиц.', 'The connected series cover accommodation establishments in Vladimir Oblast. They support comparisons of overnight stays and guests accommodated.', '已接入的数据覆盖弗拉基米尔州住宿设施，可用于比较住宿人夜数和接待住宿人数。'],
  ['Уточните запрос', 'Refine your query', '请细化问题'],
  ['Запросите сезонность размещения во Владимирской области, влияние изменений на маршрут или приоритеты проверки.', 'Ask about accommodation seasonality in Vladimir Oblast, the impact of changes on an itinerary or verification priorities.', '可查询弗拉基米尔州住宿的季节变化、变动对行程的影响或核查优先项。'],
  ['{price} ₽ за ночь · {rooms} ном. в выгрузке', '{price} RUB per night · {rooms} rooms in feed', '{price} 卢布／夜 · 数据记录 {rooms} 间房'],
  ['Снимок от {time} · объектов: {count}', 'Snapshot from {time} · sites: {count}', '快照日期 {time} · 点位数 {count}'],
  ['Учебный пример', 'Training example', '操作示例'],
  ['В учебном примере лимит Суздальского кремля снижается с 25 до 12 человек. Можно проверить влияние на две группы. Опубликованные условия музея сохраняются.', 'In the training example, the Suzdal Kremlin’s group limit drops from 25 to 12. Check the impact on both groups. The museum’s published requirements are retained.', '在操作示例中，苏兹达尔克里姆林宫的团体人数上限从 25 人降为 12 人。可核对对两个团队的影响。博物馆已发布的条件照常保留。'],
  ['Запустить учебный пример', 'Run the training example', '运行示例'],
  ['Сбросить учебный пример', 'Reset the training example', '重置示例'],
  ['Открыть учебную программу на карте', 'Open demo itinerary on map', '在地图上打开演示行程'],
  ['Сверены сведения по {count} объектам · {date}.', 'Information checked for {count} sites · {date}.', '已核对 {count} 个点位 · {date}。'],
  ['Открыть каталог объектов', 'Open site catalogue', '打开文旅点位名录'],
  ['Сопровождение', 'On-site assistance', '现场陪同'],
  ['Выходные дни', 'Closed days', '休息日'],
  ['Сезонность', 'Seasonality', '季节性'],
  ['Продолжительность визита', 'Visit duration', '参观时长'],
  ['Название в Wikidata', 'Name in Wikidata', '维基数据中的名称'],
  ['Годовое значение', 'Annual value', '年度数值'],
]);
