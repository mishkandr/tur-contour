import { createRouteMap } from '/map.js';
import { addLocaleMessages, formatDate, formatNumber, getLocale, t } from '/locale.js';
import { aiWaitingMarkup, updateAiWait } from '/knowledge.js';
import { loadPlanWeather, weatherExport, weatherSlot } from '/weather.js';
import { clockTime, routeDirections } from '/engine.mjs';
import { MIN_DRAFT_DAYS, MAX_DRAFT_DAYS, isDraftDuration } from '/draft-duration.mjs';
import { groupServiceMarkup } from '/group-services.js';
import { hideBrokenVenuePhoto, venueMedia } from '/venue-media.js';

addLocaleMessages([
  ['Маршруты','Itineraries','行程'],
  ['Новый маршрут','New itinerary','新建行程'],
  ['Продолжить черновик · {city}','Resume draft · {city}','继续草案 · {city}'],
  ['Город загружается…','Loading the city…','正在加载城市…'],
  ['Не удалось загрузить город. Выберите его в параметрах.',
    'Could not load the city. Choose it in the itinerary settings.','无法加载该城市，请在行程设置中选择。'],
  ['Убрать из маршрута {place}','Remove {place} from the itinerary','从行程中移除 {place}'],
  ['Другие варианты по опубликованным условиям','Other itineraries based on published conditions','根据已发布条件查看其他行程'],
  ['Остановки в этом маршруте','Stops in this itinerary','本行程停留地点'],
  ['{count} с конфликтом','{count} with conflicts','{count} 处冲突'],
  ['{count} нужно уточнить','{count} to confirm','{count} 处待确认'],
  ['Не подходит по условиям','Does not meet conditions','不符合条件'],
  ['Условия подтверждены','Conditions confirmed','条件已确认'],
  ['Уточните условия приёма группы у объекта.','Confirm group arrangements with the venue.','请向场馆确认团队接待条件。'],
  ['Время остановки выходит за доступные часы или время последнего входа.',
    'The stop falls outside opening hours or after last admission.','停留时段超出开放时间或晚于最晚入场时间。'],
  ['Условия и источники','Conditions and sources','条件与来源'],
  ['Предельная дата заявки · {date}','Application deadline · {date}','申请截止日期 · {date}'],
  ['Сведения сверены {date}','Sources checked on {date}','资料核对日期 {date}'],
  ['Сравнить даты выезда','Compare departure dates','比较出发日期'],
  ['Рассчитать ближайшие даты','Check nearby dates','计算近期日期'],
  ['Пересчитываем расписание на ближайшие даты…','Checking the schedule on nearby dates…','正在核查近期日期的日程…'],
  ['После выбранной даты проверено {count} вариантов.','Checked {count} dates after the selected departure.','已核查所选出发日期之后的 {count} 个日期。'],
  ['Обязательные точки {included}/{total}','Required stops {included}/{total}','必到地点 {included}/{total}'],
  ['Посещения {visits} · обеды {meals} · ночёвки {nights}',
    'Visits {visits} · lunches {meals} · overnight stays {nights}','参观 {visits} · 午餐 {meals} · 住宿 {nights}'],
  ['Можно добавить','Can be included','可加入'],
  ['Выпадает из программы','Drops out of the schedule','将从日程移除'],
  ['Текущая дата','Current date','当前日期'],
  ['Выбрать дату','Select date','选择日期'],
  ['Пересчитать на {date}','Rebuild for {date}','重新编制 {date} 的行程'],
  ['Свободные места и запись нужно подтвердить у объектов.','Confirm availability and reservations with the venues.','请向场馆确认名额和预订。'],
  ['Пересчитайте сохранённый маршрут для проверки остановок.','Rebuild the saved itinerary to check its stops.','请重新编制已保存的行程以核查各站。'],
  ['Опишите, что нужно группе','Describe what the group needs','描述团队需求'],
  ['Пожелания к маршруту','Itinerary preferences','行程偏好'],
  ['Музеи и прогулки без длинных переездов','Museums and walks without long transfers','参观博物馆并散步，避免长途换乘'],
  ['Города и условия','Cities and conditions','城市与条件'],
  ['Собрать маршрут','Build itinerary','编制行程'],
  ['Пересчитать маршрут','Rebuild itinerary','重新计算行程'],
  ['Уточнить условия с ИИ','Refine requirements with AI','用人工智能细化条件'],
  ['Ввести параметры вручную','Enter details manually','手动输入参数'],
  ['Программа по дням','Day-by-day itinerary','每日行程'],
  ['{date} · {duration} · {size} чел.','{date} · {duration} · {size} people','{date} · {duration} · {size} 人'],
  ['Смотрим даты, группу и города в запросе…','Reading dates, group size and cities…','正在读取日期、团队人数与城市…'],
  ['ИИ уточняет условия…','AI is refining the requirements…','人工智能正在细化条件…'],
  ['Подбираем объекты и составляем программу…','Finding places and building the itinerary…','正在查找地点并安排行程…'],
  ['Запрос отменён. Введённые параметры сохранены.','Request cancelled. Your input is still here.','请求已取消，已输入条件保留。'],
  ['Укажите до трёх городов для одного маршрута.','Enter no more than three cities for one itinerary.','一个行程最多可选三个城市。'],
  ['Измените запрос или откройте параметры и выберите город.','Edit your request or open the form and pick a city.','请修改需求，或打开参数并选择城市。'],
  ['Программа для проверки','Itinerary for review','待核实行程'],
  ['Перед выездом','Before departure','出发前'],
  ['Карта и источники','Map and sources','地图和数据源'],
  ['Обязательная остановка','Required stop','必到地点'],
  ['Варианты замены','Replacement candidates','替换候选'],
  ['Заменить на {place}','Replace with {place}','替换为 {place}'],
  ['Предположительно в помещении','Likely indoors','可能位于室内'],
  ['Предположительно на улице','Likely outdoors','可能位于室外'],
  ['Тип площадки нужно уточнить','Check whether the venue is indoors','请核查地点是否位于室内'],
  ['Условия для группы нужно подтвердить','Confirm conditions for the group','团队接待条件待确认'],
  ['Время остановок зависит от подтверждённого прибытия в город.',
    'Stop times depend on the confirmed arrival in the city.','停留时间取决于团队抵达城市的确认时间。'],
  ['Оценка для автомобиля · {minutes} мин. Выезд {departure} · прибытие {arrival} по местному времени.',
    'Driving estimate · {minutes} min. Depart {departure} · arrive {arrival} in local time.','自驾预计 {minutes} 分钟。当地时间 {departure} 出发，{arrival} 抵达。'],
  ['Расчёт по прямой при {speed} км/ч с запасом {buffer} мин. Сверьте фактический переезд.',
    'Based on straight-line distance at {speed} km/h plus a {buffer} min buffer. Confirm the actual trip.',
    '按直线距离、{speed} 公里/小时及 {buffer} 分钟缓冲计算。请确认实际行车安排。'],
  ['После расчётного прибытия остаётся меньше времени на посещения.',
    'Less time remains for visits after the estimated arrival.','按预计抵达时间，可用于参观的时间较少。'],
  ['Расчётный переезд заканчивается после этой даты. Для посещений нужен дополнительный день или другой транспорт.',
    'The estimated transfer ends after this date. Allow another day or use a different form of transport for visits.',
    '预计抵达时间晚于该日期。如要安排参观，请增加一天或更换交通方式。'],
  ['Объекты вне расписания','Unscheduled venue options','行程之外的备选地点'],
  ['Безбарьерный доступ указан на карте','Step-free access indicated on the map','地图标记可无障碍通行'],
  ['По карте доступ частичный','Limited step-free access on the map','地图标记无障碍通行受限'],
  ['Уточнить безбарьерный доступ','Check step-free access','请核查无障碍通行条件'],
  ['Источник сведений об объекте','Source of venue data','地点信息来源'],
  ['Официальный сайт объекта','Official venue website','地点官方网站'],
  ['Замену не удалось поставить на то же время. Программа сохранена.','The replacement no longer fits the same time slot. Your itinerary is unchanged.','替换地点不再适合该时段，原行程已保留。'],
  ['Часть прежних замен больше не подходит к новым параметрам. Проверьте расписание.','Some previous replacements no longer fit the new requirements. Review the schedule.','部分先前的替换不再符合新参数，请核查日程。'],
  ['Проверяем замену для этого времени…','Checking the replacement for this time slot…','正在核验替换地点是否适合此时段…'],
  ['Найдено несколько совпадений: {places}. Уточните название и город.','Several matches: {places}. Specify the place and city.','找到多个匹配地点：{places}。请注明地点与城市。'],
  ['Объект вне зоны выбранного транспорта','Place lies outside the selected transport radius','地点超出所选交通方式的范围'],
  ['Точка исключена вручную','Place was manually excluded','地点已手动排除'],
  ['В расписании нет подходящего времени','No suitable time slot in the itinerary','行程中无合适时段'],
  ['Обед · подтвердить для группы','Lunch · confirm for the group','午餐 · 待确认团队安排'],
  ['Обед в том же месте · подтвердить для группы','Lunch at the same venue · confirm for the group','在同一地点用午餐 · 待确认团队安排'],
  ['Ночёвка · подтвердить для группы','Overnight stay · confirm for the group','住宿 · 待确认团队安排'],
  ['Та же гостиница · подтвердить вторую ночь','Same hotel · confirm the additional night','同一家酒店 · 待确认续住'],
  ['Переезды по городу · около {minutes} мин','Local transfers · around {minutes} min','市内交通 · 约 {minutes} 分钟'],
  ['Переезд к точке · около {minutes} мин, {distance} км по прямой','Transfer to the stop · about {minutes} min, {distance} km straight-line','前往此站 · 约 {minutes} 分钟，直线距离 {distance} 公里'],
  ['Входные данные изменились. Запустите расчёт снова.','Inputs changed. Start a new calculation.','条件已更改，请重新计算。'],
  ['Показан предыдущий расчёт. Пересчитайте маршрут, чтобы сверить расписание и погоду по новым параметрам.',
    'This is the previous calculation. Rebuild the itinerary to check the schedule and weather with the new requirements.',
    '此处显示上次计算结果。请重新编制行程，以便按新条件核查日程和天气。'],
  ['В запросе неверная дата {value}. Исправьте её в запросе или укажите дату в параметрах.',
    'The date {value} in your request is invalid. Correct it in the request or set a date in the form.',
    '需求中的日期 {value} 无效。请更正日期，或在参数中重新选择。'],
  ['В запросе {value} чел. Укажите размер группы от 1 до 100 человек.',
    'The request specifies {value} people. Enter a group size from 1 to 100.',
    '需求中的团队人数为 {value}。请输入 1 至 100 人。'],
  ['Например: Казань на три дня, 12 человек, музеи и неспешные прогулки','For example: three days in Kazan, 12 people, museums and relaxed walks','例如：喀山三日，12人，博物馆与轻松步行'],
  ['Параметры маршрута','Itinerary requirements','行程参数'],
  ['Город начала','Starting city','起点城市'],
  ['Название города','City name','城市名称'],
  ['Выберите город','Choose a city','请选择城市'],
  ['Город не найден. Попробуйте другое написание.','City not found. Try a different spelling.','未找到城市，请尝试其他写法。'],
  ['Дата начала','Start date','开始日期'],
  ['Размер группы','Group size','团队人数'],
  ['Длительность','Duration','天数'],
  ['{days} день','{days} day','{days} 天'],
  ['{days} дня','{days} days','{days} 天'],
  ['{days} дней','{days} days','{days} 天'],
  ['Выберите длительность','Choose the duration','请选择天数'],
  ['Темы и ограничения','Interests and constraints','主题与限制'],
  ['Транспорт','Transport','交通方式'],
  ['Пешком','Walking','步行'],
  ['Смешанный','Mixed transport','混合交通'],
  ['Автомобиль или автобус','Car or coach','汽车或巴士'],
  ['Темп','Pace','节奏'],
  ['Закончить посещения до','Finish visits by','参观截止时间'],
  ['Примеры запросов','Sample requests','需求示例'],
  ['История и музеи · Казань','History and museums · Kazan','历史与博物馆 · 喀山'],
  ['Семейная поездка · Москва','Family itinerary · Moscow','亲子行程 · 莫斯科'],
  ['Прогулки у моря · Владивосток','Coastal walks · Vladivostok','海边漫步 · 符拉迪沃斯托克'],
  ['Два города · Москва и Казань','Two cities · Moscow and Kazan','双城行程 · 莫斯科和喀山'],
  ['Неспешный','Relaxed','轻松'],
  ['Обычный','Regular','常规'],
  ['Насыщенный','Packed','紧凑'],
  ['Обязательные объекты','Required places','必到地点'],
  ['Можно выбрать до 10 обязательных объектов. Уберите лишние из списка.','You can choose up to ten required places. Remove some from the list.','最多可选十个必到地点，请从列表中移除多余地点。'],
  ['Названия через запятую','Names separated by commas','用逗号分隔名称'],
  ['Китайскоязычное сопровождение','Chinese-language support','中文服务'],
  ['Безбарьерный доступ','Step-free access','无障碍通行'],
  ['ИИ разобрал запрос. Проверьте поля.','AI interpreted the request. Review the fields.','人工智能已解析需求，请核对字段。'],
  ['Параметры заполнены автоматически. ИИ сейчас недоступен.','Fields filled automatically. AI is currently unavailable.','已自动填写参数，人工智能暂不可用。'],
  ['ИИ занят. Параметры заполнены из запроса.','AI is busy. The fields were filled from your request.','人工智能正忙，已根据需求填写参数。'],
  ['Собрать маршрут сейчас','Build itinerary now','立即生成行程'],
  ['Запрошено дней: {days}. Выберите от {min} до {max}.','Days requested: {days}. Choose from {min} to {max}.','需求为 {days} 天。请选择 {min} 至 {max} 天。'],
  ['Выберите длительность от {min} до {max} дней.','Choose a duration from {min} to {max} days.','请选择 {min} 至 {max} 天的行程。'],
  ['Типы посещений','Visit types','参观类型'],
  ['История и архитектура','History and architecture','历史与建筑'],
  ['Музеи','Museums','博物馆'],
  ['Семейная поездка','Family itinerary','亲子行程'],
  ['Романтическая поездка','Romantic itinerary','浪漫行程'],
  ['Природа','Nature','自然'],
  ['Пеший маршрут','Hiking and walking','徒步'],
  ['Ремёсла','Crafts','工艺'],
  ['Гастрономическая поездка','Food tour','美食之旅'],
  ['Татарская кухня · Казань','Tatar cuisine · Kazan','鞑靼美食 · 喀山'],
  ['Найти отель или ресторан','Find a hotel or restaurant','查找酒店或餐厅'],
  ['Название отеля или ресторана','Hotel or restaurant name','酒店或餐厅名称'],
  ['Что ищем','Venue type','地点类型'],
  ['Все варианты','All venues','所有地点'],
  ['Отели','Hotels','酒店'],
  ['Рестораны','Restaurants','餐厅'],
  ['Город поиска','Search city','搜索城市'],
  ['Все города маршрута','All itinerary cities','行程中的所有城市'],
  ['Места и условия для группы подтвердите у отеля или ресторана.',
    'Confirm availability and group conditions with the hotel or restaurant.','请向酒店或餐厅确认可用名额和团队接待条件。'],
  ['По этому запросу ничего не найдено.','No places match this search.','未找到符合搜索条件的地点。'],
  ['Сбросить фильтры','Clear filters','清除筛选条件'],
  ['В каталоге пока нет мест для этого маршрута.',
    'The catalog has no places for this itinerary yet.','此行程的目录中暂没有地点。'],
  ['Показать ещё','Show more','显示更多'],
  ['В расписании · {when}','In the itinerary · {when}','已列入日程 · {when}'],
  ['Нет времени в расписании','No available slot in the itinerary','行程中没有可用时段'],
  ['Маршрут пересчитан. Проверьте время выбранного места.','Itinerary updated. Check the venue’s scheduled time.','行程已更新。请核对所选地点的安排时间。'],
  ['Маршрут пересчитан. Для выбранного места нет подходящего времени.','Itinerary updated. No suitable slot was found for the selected venue.','行程已更新。所选地点没有合适的时段。'],
  ['Снято требование включить это место.','This venue is no longer required.','已取消该地点的必选要求。'],
  ['Обязательный выбор','Required selection','必选地点'],
  ['Включить в маршрут','Include in itinerary','加入行程'],
  ['Убрать из обязательных','Remove requirement','取消必选'],
  ['Пересчитываем маршрут с выбранным местом…','Recalculating with the selected venue…','正在按所选地点重新计算…'],
  ['Паломничество','Pilgrimage','朝圣'],
  ['Черновик','Draft','草案'],
  ['Параметры','Settings','参数'],
  ['Скачать TXT','Download TXT','下载 TXT'],
  ['Места','Venues','地点'],
  ['Места в каталоге','Places in the catalog','目录中的地点'],
  ['Название места','Place name','地点名称'],
  ['Достопримечательности','Attractions','景点'],
  ['Найдено · {count}','Found · {count}','已找到 · {count}'],
  ['Не подобрано · {items}','Still needed · {items}','尚待安排 · {items}'],
  ['Обед','Lunch','午餐'],
  ['Ночёвка','Overnight','住宿'],
  ['Опубликованные часы · {opens}–{closes}','Published hours · {opens}–{closes}','公布的营业时间 · {opens}–{closes}'],
  ['Открыть в программе','Show in schedule','在日程中查看'],
  ['Проверка · обязательные точки вне расписания · {count}','Review · required stops outside the schedule · {count}','核查 · 未排入日程的必选地点 · {count}'],
  ['Расчёт переезда','Transfer estimate','交通时间估算'],
  ['Вернуться к маршруту','Return to itinerary','返回行程'],
  ['Работа с маршрутом','Itinerary workspace','行程工作台'],
  ['Программа','Schedule','日程'],
  ['Проверка','Review','核查'],
  ['{count} из {total} обязательных точек в расписании','{count} of {total} required places scheduled','已安排 {total} 个必选地点中的 {count} 个'],
  ['Проверить перед согласованием','Check before approval','确认前核查'],
  ['Источники маршрута','Itinerary sources','行程数据源'],
  ['Показать на карте','Show on map','在地图上查看'],
  ['Карта','Map','地图'],
  ['Карта черновика','Draft map','行程草案地图'],
  ['Целиком','Fit itinerary','显示全程'],
  ['Все дни','All days','所有日期'],
  ['День маршрута','Itinerary day','行程日期'],
  ['Темы','Interests','主题'],
  ['Исключить типы посещений','Exclude visit types','排除参观类型'],
  ['Учтённые темы','Requested interests covered','已覆盖的主题'],
  ['{count} точек','{count} places','{count} 个地点'],
  ['{count} точка','{count} place','{count} 个地点'],
  ['{count} точки','{count} places','{count} 个地点'],
  ['Подходящие точки не найдены','No matching places found','未找到符合条件的地点'],
  ['Исключено по требованиям','Excluded by requirements','按要求排除'],
  ['По данным карты безбарьерного доступа нет','Map data marks this place as inaccessible','地图数据标记此地点无法无障碍通行'],
  ['Часть посещений не помещается до {time}. Уточните время или уменьшите число остановок.',
    'Some visits do not fit before {time}. Adjust the cut-off or reduce the number of stops.',
    '部分参观无法在 {time} 前完成，请调整截止时间或减少停靠点。'],
  ['Для части выбранных территорий картографический источник не вернул объекты.',
    'The mapping source returned no places for some selected locations.','部分所选地区的地图数据未返回地点。'],
  ['Используется сохранённая выборка точек.','Using a saved collection of places.','当前使用已保存的地点集合。'],
  ['Указана прямая дистанция между городами. Время выезда и прибытия согласуйте отдельно.',
    'The intercity distance is straight-line. Confirm departure and arrival times separately.','城际距离为直线距离，请另行确认出发和抵达时间。'],
  ['Проверка условий','Check conditions','核查条件'],
  ['Ориентировочное время','Estimated time','预估时间'],
  ['Сделать обязательным','Mark as required','设为必到地点'],
  ['Исключить точку','Exclude this place','排除此地点'],
  ['Исключённые точки','Excluded places','已排除的地点'],
  ['Вернуть {place}','Restore {place}','恢复 {place}'],
  ['Черновик пересчитан','Draft recalculated','草案已重新计算'],
  ['Чтобы учесть изменения, пересчитайте черновик.','Recalculate the draft to apply the changes.','请重新计算草案以应用变更。'],
  ['Параметры изменились. Соберите черновик заново.','Requirements changed. Rebuild the draft.','参数已更改，请重新生成草案。'],
  ['Точки по данным OpenStreetMap','Places from OpenStreetMap','地点来源 OpenStreetMap'],
  ['Картографические данные недоступны','Map data unavailable','地图数据暂不可用'],
  ['Сохранённый снимок','Saved snapshot','已保存的数据快照'],
  ['Внешний источник','External source','外部数据源'],
  ['Поиск объектов недоступен','Place search unavailable','地点搜索暂不可用'],
  ['Википедия','Wikipedia','维基百科'],
  ['Wikidata и сайты объектов','Wikidata and venue websites','维基数据与地点官网'],
  ['Другие города маршрута','Other cities in the itinerary','行程中的其他城市'],
  ['Добавить город','Add a city','添加城市'],
  ['Название следующего города','Next city name','下一座城市的名称'],
  ['Добавить {city}','Add {city}','添加 {city}'],
  ['В маршруте уже есть этот город.','This city is already in the itinerary.','此城市已在行程中。'],
  ['Удалить {city}','Remove {city}','移除 {city}'],
  ['Несколько городов найдено в тексте. Проверьте порядок.','Several cities were found in the request. Check their order.','需求中识别出多个城市，请核对顺序。'],
  ['Городов больше, чем дней. Уберите лишние города или увеличьте длительность.','There are more cities than days. Remove a city or extend the itinerary.','城市数多于行程天数，请移除多余城市或延长行程。'],
  ['{from} → {to} · {distance} км по прямой','{from} → {to} · {distance} km in a straight line','{from} → {to} · 直线距离 {distance} 公里'],
  ['Междугородний переезд нужно подтвердить.','Intercity transport must be confirmed.','城际交通需要另行确认。'],
  ['Подбор объектов','Place selection','地点筛选'],
  ['Объект не попал в расписание','Place could not be scheduled','此地点未能列入行程'],
  ['Объект не найден в данных','Place was not found in the data','数据中未找到此地点'],
  ['Объект включён','Place included','已加入地点'],
  ['Время остановок и переездов ориентировочное. Для группы нужно подтвердить график, вместимость, питание, размещение и запись.',
    'Times and transfers are estimates. Confirm opening hours, capacity, meals, accommodation and reservations for the group.',
    '停留与交通时间为估算。请确认开放时间、接待能力、餐饮、住宿及预约。'],
  ['Картографический источник не вернул объекты для этой территории.','The mapping source returned no places for this area.','此地区的地图数据未返回地点。'],
  ['Используется сохранённый снимок OpenStreetMap.','Using a saved OpenStreetMap snapshot.','当前使用已保存的 OpenStreetMap 数据。'],
  ['Доступность входов, туалетов и перемещений между точками требует отдельной проверки.','Check step-free entrances, toilets and transfers separately.','请另外核查无障碍出入口、卫生间与各地点间的通行条件。'],
  ['Китайскоязычное сопровождение, перевод и питание для группы необходимо подтвердить.','Confirm Chinese-language assistance, interpreting and meals for the group.','请确认团队的中文服务、翻译及餐饮。'],
  ['Подобрать первую точку посещения.','First visit stop still needs to be selected.','尚未选定第一处参观地点。'],
  ['Подобрать вторую точку посещения.','Second visit stop still needs to be selected.','尚未选定第二处参观地点。'],
  ['Подобрать и согласовать обед для группы.','Lunch for the group still needs to be arranged.','团队午餐尚待安排确认。'],
  ['Подобрать и согласовать размещение группы.','Group accommodation still needs to be arranged.','团队住宿尚待安排确认。'],
  ['Логистика и погода','Logistics and weather','行程交通及天气'],
  ['Выбрать место для обеда','Choose a lunch venue','选择午餐地点'],
  ['Выбрать место для ночёвки','Choose overnight accommodation','选择住宿地点'],
  ['Подтвердить обед','Confirm lunch','确认午餐'],
  ['Подтвердить заселение','Confirm check-in','确认入住'],
  ['Подтвердить вторую ночь','Confirm the additional night','确认续住一晚'],
  ['Пешком по городу · около {minutes} мин (оценка по прямой)','Walking in the city · about {minutes} min estimated from straight-line distances','市内步行 · 按直线距离估算约 {minutes} 分钟'],
  ['Перемещения по городу · около {minutes} мин (оценка по прямой)','Local travel · about {minutes} min estimated from straight-line distances','市内出行 · 按直线距离估算约 {minutes} 分钟'],
]);

const themes = {heritage:'История и архитектура',museum:'Музеи',family:'Семейная поездка',romantic:'Романтическая поездка',
  nature:'Природа',hike:'Пеший маршрут',craft:'Ремёсла',pilgrimage:'Паломничество',gastro:'Гастрономическая поездка'};
const kind = {visit:'Посещение',food:'Питание',stay:'Размещение'};
const serviceGaps=new Map([
  ['Подобрать и согласовать обед для группы.','Обед'],
  ['Подобрать и согласовать размещение группы.','Ночёвка'],
]);
const delayedArrival='Расчётный переезд заканчивается после этой даты. Для посещений нужен дополнительный день или другой транспорт.';
const shorterVisits='После расчётного прибытия остаётся меньше времени на посещения.';
const safe = value=>String(value ?? '').replace(/[&<>"']/gu,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
const tr = (value,vars)=>safe(t(value,vars));
const draftDurations=Array.from({length:MAX_DRAFT_DAYS-MIN_DRAFT_DAYS+1},(_,index)=>MIN_DRAFT_DAYS+index);
function durationLabel(days) {
  const plural=new Intl.PluralRules(getLocale()).select(days);
  return t(plural==='one'?'{days} день':plural==='few'?'{days} дня':'{days} дней',{days:formatNumber(days)});
}
function tripSummary(settings) {
  return t('{date} · {duration} · {size} чел.',{
    date:formatDate(settings.date),duration:durationLabel(settings.days),size:formatNumber(settings.size),
  });
}
const name = item=>getLocale()==='zh' ? item.cn || item.name : getLocale()==='en' ? item.en || item.name : item.name;
const regionName = city=>getLocale()==='zh' ? city.regionCn || city.region : getLocale()==='en' ? city.regionEn || city.region : city.region;
const currentDate = ()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Moscow'});
const initialRequirements = date=>({date,days:2,size:8,interests:[],transport:'mixed',
  pace:'normal',market:'ru',access:false,required:[],excludedInterests:[],visitDeadline:null});
const examples = [
  ['История и музеи · Казань',
    ['Казань на три дня, 12 человек. История и музеи, неспешный темп. Обязательно «Казанский кремль».',
      'Three days in Kazan for 12 people. History and museums at a relaxed pace. Include “Kazan Kremlin”.',
      '喀山三天，12人，历史与博物馆，节奏轻松。必须参观“喀山克里姆林宫”。']],
  ['Семейная поездка · Москва',
    ['Два дня в Москве для 8 человек, семейная программа с парками, нужен безбарьерный доступ.',
      'Two days in Moscow for 8 people, family itinerary with parks and step-free access.',
      '莫斯科两天，8人，亲子公园行程，需要无障碍通行。']],
  ['Прогулки у моря · Владивосток',
    ['Владивосток, два дня для 6 человек. Природа и пешие прогулки до обеда.',
      'Two days in Vladivostok for 6 people. Nature and walking before lunch.',
      '符拉迪沃斯托克两天，6人，自然和徒步，中午前结束参观。']],
  ['Два города · Москва и Казань',
    ['Москва и Казань на три дня для 12 человек, музеи, на автомобиле.',
      'Moscow and Kazan for three days, 12 people, museums and travel by car.',
      '莫斯科和喀山三天，12人，博物馆，自驾。']],
  ['Татарская кухня · Казань',
    ['Казань на два дня для 8 человек. Гастротур с татарской кухней. Обязательно Музей чак-чака.',
      'Two days in Kazan for 8 people. Food tour featuring Tatar cuisine. Must visit the Chak-Chak Museum.',
      '喀山两天，8人，鞑靼美食之旅。必须参观恰克恰克博物馆。']],
];
const newState = ()=>({
  brief:'',lastAppliedBrief:'',query:'',cities:[],selectedCity:null,extraCities:[],settings:initialRequirements(currentDate()),
  result:null,mapDay:'all',point:null,dirty:false,
  revision:0,note:'',noteValues:null,findVersion:0,pointDay:null,unsupportedDays:null,invalidDate:null,invalidSize:null,
  omitted:[],replacements:[],overrideFields:[],requiredServices:[],
});
const cacheKey='tur-contour.current-draft.v1';
let rememberedDraft=null;
let workspace;
try {
  const saved=JSON.parse(sessionStorage.getItem(cacheKey)??'null');
  if (saved?.settings && saved?.result?.plan?.days?.length) {
    rememberedDraft=saved;
  }
} catch { /* A disabled or full session store leaves the current page usable. */ }

function retainDraft(state) {
  if (!state.result) return;
  const {brief,lastAppliedBrief,query,cities,selectedCity,extraCities,settings,result,mapDay,point,pointDay,dirty,omitted,
    unsupportedDays,invalidDate,invalidSize,replacements,overrideFields,requiredServices} = state;
  rememberedDraft={brief,lastAppliedBrief,query,cities,selectedCity,extraCities,settings,result,
    mapDay,point,pointDay,dirty,omitted,unsupportedDays,invalidDate,invalidSize,replacements,overrideFields,requiredServices};
  try {sessionStorage.setItem(cacheKey,JSON.stringify(rememberedDraft));}
  catch { /* The open draft remains available in memory. */ }
}

const options = (choices,current)=>Object.entries(choices).map(([value,label])=>'<option value="'+safe(value)+'"'+
  (String(current)===value?' selected':'')+'>'+tr(label)+'</option>').join('');

function formMarkup(state,contextual) {
  const settings = state.settings;
  const selectedDuration=state.unsupportedDays==null && isDraftDuration(settings.days) ? settings.days : null;
  const context='<p class="caption" id="draft-defaults" hidden></p><ul id="draft-context-places" class="composer-extra" hidden></ul>';
  const tripFields='<div class="composer-fields"><label class="field">'+tr('Дата начала')+
    '<input type="date" name="date" min="2000-01-01" max="2099-12-31" value="'+safe(settings.date)+'" required></label>'+
    '<div class="composer-duration"><label class="field">'+tr('Длительность')+'<select name="days" required>'+
    '<option value="" disabled hidden'+(selectedDuration==null?' selected':'')+'>'+tr('Выберите длительность')+'</option>'+
    draftDurations.map(day=>'<option value="'+day+'"'+(selectedDuration===day?' selected':'')+'>'+safe(durationLabel(day))+'</option>').join('')+
    '</select></label><p class="caption composer-duration-error" id="draft-duration-error" hidden></p></div>'+
    '<label class="field">'+tr('Размер группы')+'<input type="number" name="size" value="'+settings.size+'" min="1" max="100" required></label></div>';
  const samples='<details class="brief-examples"><summary>'+tr('Примеры запросов')+'</summary><ul>'+examples.map(([label],index)=>
    '<li><button class="button-quiet" type="button" data-composer="example" data-value="'+index+'">'+tr(label)+'</button></li>').join('')+'</ul></details>';
  const continuation='<div class="composer-city-continuation"><div id="draft-additional-cities"></div>'+
    '<details id="draft-add-city" hidden><summary>'+tr('Добавить город')+'</summary>'+
    '<label class="field">'+tr('Название следующего города')+
    '<input id="extra-city-query" type="search" autocomplete="off" maxlength="100" aria-controls="extra-city-results"></label>'+
    '<div id="extra-city-results"></div></details></div>';
  return '<section class="composer-inputs" id="planner-editor" aria-label="'+tr('Параметры')+'">'+
    '<header class="planner-editor-head" hidden><button class="button-quiet" type="button" data-composer="close-editor">'+
    tr('Вернуться к маршруту')+'</button></header>'+
    '<form id="draft-input" class="composer-form'+(contextual?' composer-form--context':'')+'" novalidate><div class="planner-brief-entry">'+
    (contextual?context+tripFields+continuation:'')+
    '<label class="field composer-request"><span>'+tr(contextual?'Пожелания к маршруту':'Опишите, что нужно группе')+
    '</span><textarea name="brief" aria-describedby="draft-defaults" rows="'+(contextual?3:4)+'" maxlength="600" placeholder="'+
    tr(contextual?'Музеи и прогулки без длинных переездов':'Например: Казань на три дня, 12 человек, музеи и неспешные прогулки')+
    '">'+safe(state.brief)+'</textarea></label>'+
    (contextual?'':context+samples)+'</div><details id="draft-parameters"><summary>'+
    tr(contextual?'Города и условия':'Ввести параметры вручную')+'</summary>'+
    '<div class="composer-parameters">'+
    '<label class="field composer-city"><span>'+tr('Город начала')+'</span><input id="city-query" type="search" value="'+
    safe(state.query)+'" placeholder="'+tr('Название города')+'" autocomplete="off" aria-controls="city-results"></label>'+
    '<div id="city-results"></div><div id="draft-omitted"></div>'+(contextual?'':continuation)+
    (contextual?'':tripFields)+
    '<details id="draft-advanced"><summary>'+tr('Темы и ограничения')+'</summary><fieldset class="composer-themes"><legend>'+tr('Типы посещений')+'</legend>'+
    Object.entries(themes).map(([theme,label])=>'<label class="check"><input type="checkbox" name="interest" value="'+theme+'"'+
      (settings.interests.includes(theme)?' checked':'')+'>'+tr(label)+'</label>').join('')+'</fieldset>'+
    '<details id="draft-exclusions"'+(settings.excludedInterests.length?' open':'')+'><summary>'+tr('Исключить типы посещений')+
    '</summary><fieldset class="composer-themes"><legend class="sr-only">'+tr('Исключить типы посещений')+'</legend>'+
    Object.entries(themes).map(([theme,label])=>'<label class="check"><input type="checkbox" name="excludedInterest" value="'+theme+'"'+
      (settings.excludedInterests.includes(theme)?' checked':'')+'>'+tr(label)+'</label>').join('')+'</fieldset></details>'+
    '<div class="composer-fields"><label class="field">'+tr('Транспорт')+'<select name="transport">'+
    options({mixed:'Смешанный',walking:'Пешком',car:'Автомобиль или автобус'},settings.transport)+'</select></label>'+
    '<label class="field">'+tr('Темп')+'<select name="pace">'+options({normal:'Обычный',relaxed:'Неспешный',dense:'Насыщенный'},settings.pace)+'</select></label>'+
    '<label class="field">'+tr('Обязательные объекты')+'<input name="required" maxlength="1000" placeholder="'+tr('Названия через запятую')+
    '" value="'+safe(settings.required.join(', '))+'"></label></div>'+
    '<label class="field composer-visit-deadline">'+tr('Закончить посещения до')+'<input type="time" min="09:00" max="18:00" name="visitDeadline" value="'+
    safe(settings.visitDeadline??'')+'"></label>'+
    '<label class="check"><input type="checkbox" name="china"'+(settings.market==='zh'?' checked':'')+'>'+tr('Китайскоязычное сопровождение')+'</label>'+
    '<label class="check"><input type="checkbox" name="access"'+(settings.access?' checked':'')+'>'+tr('Безбарьерный доступ')+'</label>'+
    '</details></div></details><div class="planner-editor-actions"><div class="composer-primary">'+
    '<button type="submit" class="button">'+tr(state.result?'Пересчитать маршрут':'Собрать маршрут')+'</button>'+
    '<button type="button" class="button-quiet" data-composer="refine">'+tr('Уточнить условия с ИИ')+'</button></div>'+
    '<div id="composer-progress" hidden></div><p id="draft-status" class="caption" role="status">'+
    (state.note ? tr(state.note,state.noteValues) : '')+'</p></div></form></section>';
}

function eligibility(item) {
  if (item.reason==='ambiguous') return t('Найдено несколько совпадений: {places}. Уточните название и город.',
    {places:item.candidates.map(candidate=>candidate.name+' ('+candidate.city+')').join(', ')});
  if (item.reason==='out-of-range') return t('Объект вне зоны выбранного транспорта');
  if (item.reason==='omitted') return t('Точка исключена вручную');
  if (item.reason==='no-slot') return t('В расписании нет подходящего времени');
  return t(item.scheduled ? 'Объект включён' : item.accessBlocked ? 'По данным карты безбарьерного доступа нет' :
    item.omitted || item.excludedInterests?.length ? 'Исключено по требованиям' :
    item.matched ? 'Объект не попал в расписание' : 'Объект не найден в данных');
}

function requirementName(item,requiredServices) {
  if (!item.requestedId) return item.label;
  const selected=requiredServices.find(place=>place.id===item.requestedId);
  return selected ? name(selected) : item.matched?.name ?? item.label;
}

function gapLabel(message) {
  if (message.startsWith('Согласовать переезд ')) return t('Междугородний переезд нужно подтвердить.');
  const cutoff = /^Часть посещений не помещается до (\d{2}:\d{2})\./u.exec(message);
  return cutoff ? t('Часть посещений не помещается до {time}. Уточните время или уменьшите число остановок.',{time:cutoff[1]}) : t(message);
}

function dayGaps(day) {
  return day.missing.filter(message=>!(day.transfer && message.startsWith('Согласовать переезд ')) &&
    !(day.logistics?.arrivalAfterDay && message===delayedArrival) &&
    !(day.transfer?.timing?.visitsLimited && message===shorterVisits)).map(gapLabel);
}

function evidenceSources(result) {
  return (result.sources?.length ? result.sources : [result.source]).flatMap(source=>[
    source,...[source.supplemental,...(source.retained ?? [])].filter(Boolean).map(item=>({...item,city:source.city})),
  ]);
}

function placeCount(count) {
  const category=new Intl.PluralRules(getLocale()).select(count);
  return t(category==='one'?'{count} точка':category==='few'?'{count} точки':'{count} точек',{count:formatNumber(count)});
}

function coverageMarkup(coverage) {
  if (!coverage?.length) return '';
  return '<div class="composer-coverage"><h3>'+tr('Учтённые темы')+'</h3><ul>'+coverage.map(({theme,count})=>
    '<li><strong>'+tr(themes[theme]??theme)+'</strong><span class="chip '+(count?'':'warn')+'">'+
    safe(count?placeCount(count):t('Подходящие точки не найдены'))+'</span></li>').join('')+'</ul></div>';
}

function dayLogistics(day) {
  if (!day.logistics) return [];
  const {lunch,overnight,estimatedTransferMinutes}=day.logistics;
  return [
    ...(lunch.status==='suggested' ? [t(lunch.repeated?'Обед в том же месте · подтвердить для группы':'Обед · подтвердить для группы')] : []),
    ...(overnight.status==='suggested' ? [t(overnight.action==='return'?'Та же гостиница · подтвердить вторую ночь':'Ночёвка · подтвердить для группы')] : []),
    ...(estimatedTransferMinutes ? [t('Переезды по городу · около {minutes} мин',{minutes:formatNumber(estimatedTransferMinutes)})] : []),
  ];
}

function transferNotes(day,result) {
  const transfer=day.transfer;
  const delayed = day.logistics?.arrivalAfterDay ? [t(delayedArrival)] : [];
  if (!transfer) return delayed;
  const timing=transfer.timing;
  const distance=t('{from} → {to} · {distance} км по прямой',{
    from:name(result.locations?.find(city=>city.id===transfer.fromId)??{name:transfer.from}),
    to:name(result.locations?.find(city=>city.id===transfer.toId)??{name:transfer.to}),distance:formatNumber(transfer.distanceKm)});
  const estimated=timing?.status==='estimated' && timing.departureTime && timing.arrivalTime;
  const local=(date,time)=>date && date!==day.date?formatDate(date)+' '+time:time;
  const notes=estimated ? [
    t('Оценка для автомобиля · {minutes} мин. Выезд {departure} · прибытие {arrival} по местному времени.',{
      minutes:formatNumber(timing.reserveMinutes),departure:local(timing.departureDate,timing.departureTime),
      arrival:local(timing.arrivalDate,timing.arrivalTime)}),
    t('Расчёт по прямой при {speed} км/ч с запасом {buffer} мин. Сверьте фактический переезд.',{
      speed:formatNumber(timing.assumedSpeedKmh),buffer:formatNumber(timing.bufferMinutes)}),
  ] : [t('Время остановок зависит от подтверждённого прибытия в город.')];
  if (timing?.visitsLimited && !delayed.length) notes.push(t(shorterVisits));
  return [distance,...notes,...delayed];
}

function transferMarkup(day,result) {
  const notes=transferNotes(day,result);
  if (!notes.length) return '';
  if (!day.transfer) return '<div class="composer-transfer"><p>'+safe(notes[0])+'</p></div>';
  const [distance,...detail]=notes;
  const candidates=day.transfer.candidates ?? [];
  const exception=day.logistics?.arrivalAfterDay ? t(delayedArrival) : day.transfer.timing?.visitsLimited ? t(shorterVisits) : null;
  return '<div class="composer-transfer"><p><strong>'+safe(distance)+'</strong></p>'+
    (exception?'<p>'+safe(exception)+'</p>':'')+
    '<details><summary>'+tr('Расчёт переезда')+'</summary>'+detail.filter(note=>note!==exception).map(note=>'<p>'+safe(note)+'</p>').join('')+
    (candidates.length?'<p>'+tr('Объекты вне расписания')+'</p><ul>'+candidates.map(candidate=>
      '<li><a href="'+safe(candidate.url)+'" target="_blank" rel="noopener noreferrer" data-source-text>'+safe(name(candidate))+'</a></li>').join('')+
      '</ul>':'')+'</details></div>';
}

function forecastDays(result, dirty=false) {
  return result.plan.days.map(day=>{
    const city = result.locations?.find(location=>location.id===day.cityId) ?? result.location;
    const outdoors = day.stops.filter(stop=>stop.exposure==='outdoors');
    const stop = !dirty && outdoors.find(item=>item.alternatives?.some(candidate=>candidate.exposure==='indoors'));
    return {date:day.date,coordinates:day.logistics?.arrivalAfterDay ? null : city?.coordinates,
      outdoors:outdoors.length>0 || result.plan.settings.interests?.some(theme=>['hike','nature'].includes(theme)),
      alternative:stop?{stop,name:name(stop)}:null};
  });
}

function accessEvidence(requireAccess,place) {
  if (!requireAccess) return '';
  return t(place?.wheelchairHint==='yes'?'Безбарьерный доступ указан на карте':
    place?.wheelchairHint==='limited'?'По карте доступ частичный':'Уточнить безбарьерный доступ');
}

function replacementMarkup(stop,places,settings,dirty) {
  if (dirty || !stop.alternatives?.length) return '';
  const choices=stop.exposure==='outdoors' ? stop.alternatives.toSorted((a,b)=>Number(b.exposure==='indoors')-Number(a.exposure==='indoors')) :
    stop.alternatives;
  return '<details class="composer-alternatives"><summary>'+tr('Варианты замены')+'</summary><ul>'+choices.map((alternative,index)=>{
    const evidenceId='replacement-facts-'+index;
    const exposure=stop.type==='visit' ? t(alternative.exposure==='indoors'?'Предположительно в помещении':
      alternative.exposure==='outdoors'?'Предположительно на улице':'Тип площадки нужно уточнить') : '';
    const notes=[exposure,accessEvidence(settings.access,places.get(alternative.id)),t('Условия для группы нужно подтвердить')];
    return '<li><button type="button" class="link-button" aria-describedby="'+evidenceId+'" data-composer="replace-stop" data-previous="'+
      safe(stop.id)+'" data-value="'+safe(alternative.id)+'">'+tr('Заменить на {place}',{place:name(alternative)})+
      '</button><p class="caption" id="'+evidenceId+'">'+safe(notes.filter(Boolean).join(' · '))+'</p></li>';
  }).join('')+'</ul><div class="composer-swap-feedback">'+
    '<div class="composer-swap-progress" hidden></div><p class="caption composer-swap-status" role="status"></p></div></details>';
}

function serviceSearchMarkup(result,view) {
  const locations=result.locations ?? [result.location];
  return '<section id="draft-services" class="composer-services" aria-labelledby="draft-service-title">'+
    '<h3 id="draft-service-title" tabindex="-1">'+tr('Места в каталоге')+'</h3>'+
    '<div class="composer-service-fields"><label class="field">'+tr('Название места')+
    '<input type="search" id="draft-service-query" value="'+safe(view.query)+'" maxlength="100"></label>'+
    '<label class="field composer-service-select">'+tr('Что ищем')+'<select id="draft-service-kind">'+
    options({all:'Все варианты',visit:'Достопримечательности',stay:'Отели',food:'Кафе и рестораны'},view.kind)+'</select></label>'+
    (locations.length>1?'<label class="field composer-service-select">'+tr('Город поиска')+'<select id="draft-service-city">'+
      '<option value="">'+tr('Все города маршрута')+'</option>'+locations.map(city=>
        '<option value="'+safe(city.name)+'"'+(view.city===city.name?' selected':'')+' data-source-text>'+safe(name(city))+'</option>').join('')+
      '</select></label>':'')+'</div>'+
    '<div class="composer-service-feedback"><div class="composer-swap-progress" hidden></div><p class="caption composer-swap-status" role="status"></p></div>'+
    '<div id="draft-service-list"></div></section>';
}

function draftDayRisks(result) {
  const service = (choice, day, label, missing, kind) => {
    if (!choice || choice.status === 'not-required') return '';
    const stop = day.stops.find(item => item.id === choice.id);
    if (!stop) {
      return '<p><button type="button" class="link-button" data-composer="open-venues" data-value="'+kind+'" data-city="'+
        safe(day.city)+'">'+tr(missing)+'</button></p>';
    }
    const title = '<span data-source-text>'+safe(name(stop))+'</span>';
    const venue = stop.url ? '<a href="'+safe(stop.url)+'" target="_blank" rel="noopener noreferrer">'+title+'</a>' : title;
    return '<p class="draft-logistics-service"><span><strong>'+tr(label)+'</strong> <span class="draft-logistics-hours">'+
      safe(stop.start)+'–'+safe(stop.end)+'</span></span> '+venue+'</p>';
  };
  const days = result.plan.days.map((day, index) => {
    const { lunch, overnight, estimatedTransferMinutes, arrivalAfterDay } = day.logistics ?? {};
    const city = result.locations?.find(location => location.id === day.cityId);
    const date = '<time datetime="'+safe(day.date)+'">'+safe(formatDate(day.date))+'</time>';
    const heading = tr('День {day}',{day:formatNumber(index+1)})+' · '+date+
      (result.locations?.length > 1 && city ? ' · <span data-source-text>'+safe(name(city))+'</span>' : '');
    const duration = estimatedTransferMinutes > 0 ? '<p>'+tr(result.settings.transport === 'walking' ?
      'Пешком по городу · около {minutes} мин (оценка по прямой)' : 'Перемещения по городу · около {minutes} мин (оценка по прямой)',{
      minutes:formatNumber(estimatedTransferMinutes)})+'</p>' : '';
    return '<section class="draft-logistics-day"><h4>'+heading+'</h4>'+transferMarkup(day,result)+
      (!arrivalAfterDay ? service(lunch,day,'Подтвердить обед','Выбрать место для обеда','food')+
        service(overnight,day,overnight?.action === 'return' ? 'Подтвердить вторую ночь' : 'Подтвердить заселение','Выбрать место для ночёвки','stay')+
        duration+weatherSlot(index) : '')+'</section>';
  });
  return '<details id="draft-day-risks" class="draft-logistics"><summary>'+tr('Логистика и погода')+'</summary>'+days.join('')+'</details>';
}

function publishedCheck(result) {
  const cities=result.locations?.map(city=>city.name) ?? [];
  const settings=result.settings;
  if (![2,3].includes(settings.days)) return '';
  const direction=routeDirections.find(item=>cities.length>=2 && cities.every((city,index)=>item.centres[index]===city));
  if (!direction) return '';
  const theme=direction.themes.includes(settings.theme) ? settings.theme : 'any';
  const query=new URLSearchParams({scope:'pilot',direction:direction.id,date:settings.date,days:settings.days,size:settings.size,
    market:settings.market,theme,access:settings.access?'1':'0'});
  return '<a class="button-quiet draft-published-alternatives" href="#route?'+safe(query.toString())+'">'+tr('Другие варианты по опубликованным условиям')+'</a>';
}

const draftCheckLabels={blocked:'Не подходит по условиям',unknown:'Нужно уточнить',ready:'Условия подтверждены'};

function draftStopChecks(result) {
  const {verification,plan,places}=result;
  if (!verification) return '<p class="caption">'+tr('Пересчитайте сохранённый маршрут для проверки остановок.')+'</p>';
  if (!verification.some(day=>day.length)) return '';
  const venues=new Map(places.map(place=>[place.id,place]));
  const link=(url,label)=>'<a href="'+safe(url)+'" target="_blank" rel="noopener noreferrer">'+tr(label)+'</a>';
  const fact=item=>'<li><p lang="ru" data-source-text>'+safe(item.text)+'</p>'+link(item.url,'Источник')+'</li>';
  return '<section class="draft-check-ledger" aria-labelledby="draft-check-title"><header><h4 id="draft-check-title">'+
    tr('Остановки в этом маршруте')+'</h4></header>'+plan.days.map((day,index)=>{
    if (!day.stops.length) return '';
    const conflicts=verification[index].filter(stop=>stop.status==='blocked').length;
    return '<details class="draft-check-day"'+(index===0?' open':'')+'><summary><span>'+tr('День {day}',{day:formatNumber(index+1)})+' · '+
      safe(formatDate(day.date))+'</span>'+(conflicts?'<span class="chip error">'+tr('{count} с конфликтом',{count:formatNumber(conflicts)})+'</span>':'')+
      '</summary>'+
      '<ol>'+day.stops.map((stop,stopIndex)=>{
        const check=verification[index][stopIndex];
        const hours=check.hours;
        const hoursLabel=hours?.windows?.length ? hours.windows.map(([start,end])=>clockTime(start)+'–'+clockTime(end)).join(', ') :
          hours?.windows ? t('Закрыто по графику') : t('График не покрывает дату');
        const lastEntry=hours?.lastEntryMinutes && hours.windows?.length ?
          hours.windows.map(([,end])=>clockTime(end-hours.lastEntryMinutes)).join(', ') : null;
        const limits=check.limits.map(fact).join('');
        const notes=check.notes.map(fact).join('');
        const reasons=check.reasons.map(reason=>{
          const max=/^Опубликованный лимит для этого посещения — (\d+) чел\.$/u.exec(reason);
          return '<li>'+(max ? tr('Опубликованный лимит для этого посещения — {limit} чел.',{limit:formatNumber(Number(max[1]))}) : tr(reason))+'</li>';
        }).join('');
        const booking=check.booking;
        const media=venueMedia(venues.get(stop.id),name(stop));
        return '<li class="draft-check-stop" data-status="'+check.status+'"><div class="draft-check-heading"><time>'+safe(stop.start)+'–'+safe(stop.end)+
          '</time><strong data-source-text>'+safe(name(stop))+'</strong><span class="chip '+(check.status==='blocked'?'error':check.status==='unknown'?'warn':'')+'">'+
          tr(draftCheckLabels[check.status])+'</span></div>'+(check.status==='blocked' && reasons ? '<ul class="draft-check-alerts">'+reasons+'</ul>' : '')+
          '<details><summary>'+tr('Условия и источники')+'</summary><div class="draft-check-facts">'+
          (check.status==='unknown' && reasons ? '<ul class="draft-check-alerts">'+reasons+'</ul>' : '')+
          (hours ? '<p><strong>'+safe(hoursLabel)+'</strong> · '+link(hours.url,'Опубликованный график')+'</p>' : '')+
          (lastEntry ? '<p>'+tr('Последний вход {time}',{time:lastEntry})+'</p>' : '')+
          (booking ? '<p lang="ru" data-source-text>'+safe(booking.text)+'</p><p>'+link(booking.url,'Правила записи')+'</p>' : '')+
          (check.deadline ? '<p>'+tr('Предельная дата заявки · {date}',{date:formatDate(check.deadline.date)})+' · '+link(check.deadline.url,'Оферта музея')+'</p>' : '')+
          (limits?'<ul>'+limits+'</ul>':'')+(notes?'<ul>'+notes+'</ul>':'')+
          '<p>'+link(stop.url,'Страница объекта')+(media.detail?' · '+media.detail:'')+'</p>'+
          (check.checkedAt ? '<p class="caption">'+tr('Сведения сверены {date}',{date:formatDate(check.checkedAt)})+'</p>' : '')+
          '</div></details></li>';
    }).join('')+'</ol></details>';
  }).join('')+'</section>';
}

function draftDateReview(dirty) {
  return '<details class="draft-date-review" id="draft-date-review"><summary>'+tr('Сравнить даты выезда')+'</summary>'+
    '<div class="draft-date-feedback"><button class="button-quiet" type="button" data-composer="compare-dates"'+(dirty?' disabled':'')+'>'+
    tr('Рассчитать ближайшие даты')+'</button><div class="composer-swap-progress" hidden></div><p class="caption composer-swap-status" role="status"></p>'+
    '<div id="draft-date-options"></div></div></details>';
}

function draftDateOptions({current,options}) {
  const metrics = row => [row.totalRequired ? tr('Обязательные точки {included}/{total}',{
    included:formatNumber(row.required),total:formatNumber(row.totalRequired)}) : '',
    tr('Посещения {visits} · обеды {meals} · ночёвки {nights}',{
      visits:formatNumber(row.visits),meals:formatNumber(row.meals),nights:formatNumber(row.nights)}),
  ].filter(Boolean).join(' · ');
  const changes = (label,places) => places.length ? '<p><strong>'+tr(label)+'</strong> · <span data-source-text>'+
    safe(places.join(', '))+'</span></p>' : '';
  return '<ul class="draft-date-list">'+[current,...options].map((row,index)=>{
    const date = formatDate(row.date);
    return '<li><div><strong>'+(index===0?tr('Текущая дата')+' · ':'')+'<time datetime="'+safe(row.date)+'">'+safe(date)+'</time></strong>'+
      '<p class="caption">'+metrics(row)+'</p>'+changes('Можно добавить',row.gained)+changes('Выпадает из программы',row.lost)+'</div>'+
      (index===0?'':'<button class="button-quiet" type="button" data-composer="use-date" data-value="'+safe(row.date)+'" aria-label="'+
        tr('Пересчитать на {date}',{date})+'">'+tr('Выбрать дату')+'</button>')+'</li>';
  }).join('')+'</ul><p class="caption">'+tr('Свободные места и запись нужно подтвердить у объектов.')+'</p>';
}

function draftMarkup(result,serviceView,state) {
  const {location,plan,settings} = result;
  const venues = result.locations ?? [location];
  const requiredCount=plan.required.filter(item=>item.scheduled).length;
  const missingRequired=plan.required.length-requiredCount;
  const verifiedStops=result.verification?.flat() ?? [];
  const blockedCount=verifiedStops.filter(stop=>stop.status==='blocked').length;
  const unknownCount=verifiedStops.filter(stop=>stop.status==='unknown').length;
  const sources = evidenceSources(result).map(item=>{
    const status = item.status==='live' ? 'Внешний источник' : item.status==='snapshot' ? 'Сохранённый снимок' : 'Поиск объектов недоступен';
    const date = item.checkedAt && Number.isFinite(Date.parse(item.checkedAt)) ? ' · '+formatDate(item.checkedAt) : '';
    return '<li><a href="'+safe(item.url)+'" target="_blank" rel="noopener noreferrer">'+tr(item.name)+'</a>'+
      ' · '+tr(status)+safe(date)+(item.city && venues.length>1?' · '+safe(item.city):'')+'</li>';
  }).join('');
  return '<section class="composer-output" data-dirty="'+state.dirty+'" aria-labelledby="draft-title"><header class="composer-title"><div>'+
    '<h2 id="draft-title" tabindex="-1" data-source-text>'+safe(venues.map(name).join(' → '))+'</h2><p class="caption"><strong>'+tr('Черновик')+'</strong> · '+
    safe(tripSummary(settings))+
    (settings.access?' · '+tr('Безбарьерный доступ'):'')+
    '</p></div><div class="planner-toolbar-actions">'+
    '<button class="button-quiet" type="button" data-composer="edit-editor" aria-controls="planner-editor">'+tr('Параметры')+'</button>'+
    '<button class="button-quiet" type="button" data-composer="export"'+(state.dirty?' disabled':'')+'>'+tr('Скачать TXT')+'</button>'+
    '</div></header><p class="callout composer-stale" role="status"'+(state.dirty?'':' hidden')+'>'+
    tr('Показан предыдущий расчёт. Пересчитайте маршрут, чтобы сверить расписание и погоду по новым параметрам.')+'</p>'+
    '<div class="planner-switch" role="group" aria-label="'+tr('Работа с маршрутом')+'">'+
    [['schedule','Программа'],['map','Карта'],['venues','Места'],['review','Проверка']].map(([key,label])=>
      '<button type="button" data-composer="workspace-view" data-value="'+key+'" aria-pressed="false"'+
      (key==='review' && missingRequired?
        ' aria-label="'+tr('Проверка · обязательные точки вне расписания · {count}',{count:formatNumber(missingRequired)})+'"':'')+'>'+tr(label)+
      (key==='review' && missingRequired?' <span aria-hidden="true">· '+safe(formatNumber(missingRequired))+'</span>':'')+'</button>').join('')+'</div>'+
    '<div class="planner-workarea" data-view="schedule"><div class="composer-day-head">'+
    '<div class="atlas-options" id="draft-days" role="group" aria-label="'+tr('Дни маршрута')+'"></div></div>'+
    '<section class="planner-schedule" aria-labelledby="draft-schedule-title"><h3 id="draft-schedule-title" class="sr-only">'+tr('Программа по дням')+'</h3>'+
    '<div id="draft-timeline"></div></section><section class="composer-map-frame" aria-labelledby="draft-map-title">'+
    '<div class="atlas-map-top"><h3 id="draft-map-title">'+tr('Карта')+'</h3>'+
    '<button class="button-quiet" data-composer="fit" type="button">'+tr('Целиком')+'</button></div><div id="draft-map-stop" hidden></div>'+
    '<div class="composer-map-scene"><div id="draft-map" role="region" aria-label="'+tr('Карта черновика')+'"></div></div></section>'+
    serviceSearchMarkup(result,serviceView)+
    '<section class="composer-evidence"><h3>'+tr('Проверить перед согласованием')+'</h3>'+
    (verifiedStops.length?'<p class="draft-check-totals"><span class="chip '+(blockedCount?'error':'plain')+'">'+
      tr('{count} с конфликтом',{count:formatNumber(blockedCount)})+'</span><span class="chip '+(unknownCount?'warn':'plain')+'">'+
      tr('{count} нужно уточнить',{count:formatNumber(unknownCount)})+'</span></p>':'')+
    (plan.required.length?'<p class="planner-check-summary">'+tr('{count} из {total} обязательных точек в расписании',{
      count:formatNumber(requiredCount),total:formatNumber(plan.required.length)})+'</p>':'')+'<ul>'+
    plan.required.filter(item=>!item.scheduled).map(item=>'<li><span data-source-text>'+safe(requirementName(item,state.requiredServices))+'</span> · '+safe(eligibility(item))+'</li>').join('')+
    '</ul>'+draftDateReview(state.dirty)+groupServiceMarkup(result.groupServices)+draftDayRisks(result)+draftStopChecks(result)+publishedCheck(result)+'</section>'+
    '<div class="planner-sources">'+coverageMarkup(plan.interestCoverage)+'<h3>'+tr('Источники маршрута')+'</h3>'+
    '<ul class="composer-source">'+sources+'<li><a href="'+safe(location.sourceUrl)+'" target="_blank" rel="noopener noreferrer">GeoNames</a></li></ul></div>'+
    '</div></section>';
}

function download(result,requiredServices) {
  const {location,plan,settings,warnings} = result;
  const places = new Map(result.places.map(place=>[place.id,place]));
  const weather = weatherExport(forecastDays(result));
  const summary = tripSummary(settings);
  const lines = [t('Черновик')+' · '+(result.locations??[location]).map(name).join(' → '),summary,
    ...(settings.access?[t('Безбарьерный доступ')]:[]),
    ...evidenceSources(result).map(item=>t(item.name)+' · '+item.url), location.sourceUrl,'',
    ...plan.days.flatMap((day,index)=>[t('День {day}',{day:index+1})+' · '+formatDate(day.date)+' · '+(day.cityId ?
      name(result.locations?.find(item=>item.id===day.cityId)??location):name(location)),
      ...transferNotes(day,result),
      ...weather[index],...day.stops.map((stop,stopIndex)=>{
        const place=places.get(stop.id);
        const check=result.verification?.[index]?.[stopIndex];
        return [stop.start+'–'+stop.end+' '+name(stop),check && t(draftCheckLabels[check.status]),
          check?.hours?.url,accessEvidence(settings.access,place),stop.url,
          place?.officialUrl && place.officialUrl!==stop.url ? t('Официальный сайт объекта')+' '+place.officialUrl : ''].filter(Boolean).join(' · ');
      }),...dayLogistics(day),...dayGaps(day),
      ...(day.transfer?.candidates?.length?[t('Объекты вне расписания'),...day.transfer.candidates.map(candidate=>name(candidate)+' · '+candidate.url)]:[]),'']),
    t('Проверка условий'),...warnings.map(t),...plan.required.map(item=>requirementName(item,requiredServices)+' · '+eligibility(item)),
    ...(plan.interestCoverage??[]).map(({theme,count})=>t(themes[theme]??theme)+' · '+
      (count?placeCount(count):t('Подходящие точки не найдены')))];
  const file = URL.createObjectURL(new Blob(['\uFEFF',lines.join('\n')],{type:'text/plain;charset=utf-8'}));
  const a = document.createElement('a');
  a.href = file;
  a.download = 'tur-contour-'+settings.date+'-'+getLocale()+'.txt';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(file),1000);
}

export function mountComposer(container, api, query, {restoreWorkspace=false}={}) {
  const find = selector=>container.querySelector(selector);
  const resume=query.get('draft')==='1';
  const cityId=query.get('city');
  const placeId=query.get('place');
  const label=query.get('label')?.trim().slice(0,160);
  const placeKind=query.get('kind');
  const existingWorkspace=restoreWorkspace && workspace?.hash===location.hash ? workspace : null;
  const state=existingWorkspace?.state ?? {...newState(),...(resume && rememberedDraft ? structuredClone(rememberedDraft) : {})};
  if (isDraftDuration(state.unsupportedDays) && !state.overrideFields.includes('days')) {
    state.settings.days=state.unsupportedDays;
    state.unsupportedDays=null;
    state.lastAppliedBrief='';
  }
  const contextual=existingWorkspace?.contextual ?? /^\d{1,12}$/u.test(cityId ?? '');
  workspace={hash:location.hash,state,contextual,view:existingWorkspace?.view ?? 'schedule'};
  const initialCityController=new AbortController();
  let loadingCity=/^\d{1,12}$/u.test(cityId ?? '') && !state.selectedCity;
  let map;
  let localizedGeodata;
  let searchTimer;
  let extraSearchTimer;
  let extraSearchVersion=0;
  let extraMatches=[];
  let pending;
  let mounted=true;
  let workView=workspace.view;
  const serviceView={query:'',kind:'all',city:'',limit:8};
  container.innerHTML = '<header class="planner-heading"><h1>'+tr('Маршруты')+'</h1><div id="draft-navigation"></div></header>'+
    '<div class="composer-layout">'+formMarkup(state,contextual)+
    '<div class="composer-result" id="composer-result"></div></div>';
  const mapVisibility=window.matchMedia('(min-width: 1050px)');
  function paintDraftNavigation() {
    const rememberedLocation=rememberedDraft?.result.location;
    find('#draft-navigation').innerHTML=state.result?'<a class="button-quiet" href="#route">'+tr('Новый маршрут')+'</a>':
      rememberedLocation?'<a class="button-quiet" href="#route?draft=1">'+tr('Продолжить черновик · {city}',{
        city:name(rememberedLocation)})+'</a>':'';
  }
  function paintRequiredPlaces() {
    const list=find('#draft-context-places');
    list.hidden=!state.requiredServices.length;
    list.innerHTML=state.requiredServices.map(place=>'<li><button type="button" class="button-quiet" data-composer="remove-required" data-value="'+
      safe(place.id)+'" aria-label="'+tr('Убрать из маршрута {place}',{place:name(place)})+'">'+safe(name(place))+' <span aria-hidden="true">×</span></button></li>').join('');
  }
  const saveWorkspaceDraft=()=>retainDraft(state);
  function setEditor(open) {
    find('#planner-editor').hidden=!open;
    find('.planner-editor-head').hidden=!state.result;
    find('[data-composer=edit-editor]')?.setAttribute('aria-expanded',String(open));
  }
  const syncAdditionalCitiesControl=()=>{find('#draft-add-city').hidden=!state.selectedCity || state.extraCities.length>=2;};
  function cityOptions(noMatches=false) {
    if (!mounted) return;
    find('#city-results').innerHTML = state.cities.length ? '<label class="field"><span class="sr-only">'+tr('Выберите город')+'</span>'+
      '<select id="city-id" aria-label="'+tr('Выберите город')+'"><option value="">'+tr('Выберите город')+'</option>'+
      state.cities.map(city=>'<option value="'+safe(city.id)+'"'+(city.id===state.selectedCity?.id?' selected':'')+'>'+safe(name(city))+
        (city.region?' · '+safe(regionName(city)):'')+'</option>').join('')+'</select></label>' : noMatches ?
      '<p class="caption" role="status">'+tr('Город не найден. Попробуйте другое написание.')+'</p>':'';
    find('#draft-additional-cities').innerHTML=state.extraCities.length ? '<p class="caption">'+tr('Другие города маршрута')+'</p>'+
      '<ul class="composer-extra">'+state.extraCities.map(city=>'<li><button type="button" class="button-quiet" data-composer="remove-city" data-value="'+safe(city.id)+
      '" aria-label="'+tr('Удалить {city}',{city:name(city)})+'"><span data-source-text>'+safe(name(city))+'</span> <span aria-hidden="true">×</span></button></li>').join('')+'</ul>':'';
    syncAdditionalCitiesControl();
    find('#draft-omitted').innerHTML=state.omitted.length ? '<p class="caption">'+tr('Исключённые точки')+'</p>'+
      '<ul class="composer-extra">'+state.omitted.map(place=>'<li><button type="button" class="button-quiet" data-composer="restore-stop" data-value="'+safe(place.id)+
      '" aria-label="'+tr('Вернуть {place}',{place:name(place)})+'"><span data-source-text>'+safe(name(place))+'</span> <span aria-hidden="true">↶</span></button></li>').join('')+'</ul>':'';
  }
  function searchAdditionalCity(query) {
    const results=find('#extra-city-results');
    const version=++extraSearchVersion;
    clearTimeout(extraSearchTimer);
    extraMatches=[];
    results.replaceChildren();
    if (query.length<2) return;
    extraSearchTimer=setTimeout(async()=>{
      try {
        const {cities}=await api('cities?q='+encodeURIComponent(query));
        if (!mounted || version!==extraSearchVersion) return;
        const chosen=new Set([state.selectedCity?.id,...state.extraCities.map(city=>city.id)]);
        extraMatches=cities.filter(city=>!chosen.has(city.id)).slice(0,5);
        results.innerHTML=extraMatches.length?'<ul class="composer-extra-city-results">'+extraMatches.map(city=>
          '<li><button type="button" class="button-quiet" data-composer="add-city" data-value="'+safe(city.id)+
          '"><span>'+tr('Добавить {city}',{city:name(city)})+'</span>'+
          (city.region?'<small>'+safe(regionName(city))+'</small>':'')+'</button></li>').join('')+'</ul>':
          '<p class="caption" role="status">'+tr(cities.length?'В маршруте уже есть этот город.':
            'Город не найден. Попробуйте другое написание.')+'</p>';
      } catch(error) {
        if (mounted && version===extraSearchVersion) results.textContent=t(error.message);
      }
    },250);
  }
  function updateExtraction() {
    if (!mounted) return;
    const fields=find('#draft-input').elements;
    for(const key of ['date','size','transport','pace']) fields[key].value=state.settings[key];
    fields.days.value=state.unsupportedDays==null && isDraftDuration(state.settings.days) ? state.settings.days : '';
    fields.required.value=state.settings.required.join(', ');
    fields.visitDeadline.value=state.settings.visitDeadline??'';
    fields.china.checked=state.settings.market==='zh';
    fields.access.checked=state.settings.access;
    [...find('#draft-input').querySelectorAll('[name=interest]')].forEach(control=>{control.checked=state.settings.interests.includes(control.value);});
    [...find('#draft-input').querySelectorAll('[name=excludedInterest]')].forEach(control=>{control.checked=state.settings.excludedInterests.includes(control.value);});
    if (state.settings.interests.length || state.settings.required.length || state.settings.access || state.settings.visitDeadline ||
        state.settings.excludedInterests.length) find('#draft-advanced').open=true;
    if (state.settings.excludedInterests.length) find('#draft-exclusions').open=true;
    find('#city-query').value=state.query;
    cityOptions();
    showNote(state.note,state.noteValues);
    showDefaults();
  }
  function showDefaults() {
    const {date,days}=state.settings;
    const defaults=find('#draft-defaults');
    defaults.hidden=!state.selectedCity || (!contextual && !Number.isFinite(Date.parse(date)));
    if (defaults.hidden) return;
    const scope=[state.selectedCity,...state.extraCities].map(name).join(' → ');
    defaults.textContent=contextual || state.unsupportedDays!=null || !isDraftDuration(days) ? scope :
      scope+' · '+tripSummary(state.settings);
  }
  function showNote(message, values) {
    if (!mounted) return;
    const issue=parameterIssue();
    const duration=durationIssue();
    state.note=message===duration?.message ? '' : message;
    state.noteValues=state.note ? values : null;
    find('#draft-status').textContent=state.note?t(state.note,values):'';
    const durationError=find('#draft-duration-error');
    durationError.hidden=!duration;
    durationError.textContent=duration ? t(duration.message,duration.values) : '';
    for (const name of ['date','size','days']) {
      const field=find('#draft-input').elements[name];
      if (name==='days' ? duration : name===issue?.field && message===issue.message) {
        field.setAttribute('aria-invalid','true');
        field.setAttribute('aria-describedby',name==='days'?'draft-duration-error':'draft-status');
      } else {
        field.removeAttribute('aria-invalid');
        field.removeAttribute('aria-describedby');
      }
    }
  }
  function syncActions() {
    if (!mounted) return;
    const form=find('#draft-input');
    const submit=form.querySelector('[type=submit]');
    submit.disabled=loadingCity || Boolean(pending && !pending.refining);
    submit.textContent=t(pending?.refining?'Собрать маршрут сейчас':state.result?'Пересчитать маршрут':'Собрать маршрут');
    find('[data-composer=close-editor]').disabled=Boolean(pending && !pending.feedback);
    find('[data-composer=refine]').disabled=loadingCity || Boolean(pending) || state.brief.trim().length<3;
    for (const button of container.querySelectorAll('[data-composer=service-include],[data-composer=service-release],[data-composer=compare-dates],[data-composer=use-date]')) {
      button.disabled=Boolean(pending) || state.dirty;
    }
  }
  function phase(label) {
    const node=pending.progress;
    node.innerHTML=aiWaitingMarkup(label,pending.startedAt,'cancel-composer');
    node.hidden=false;
  }
  function paintServices() {
    const list=find('#draft-service-list');
    if (!list || !state.result) return;
    const folded=value=>String(value ?? '').normalize('NFKC').toLocaleLowerCase().replaceAll('ё','е');
    const query=folded(serviceView.query.trim());
    const scheduled=state.result.plan.days.flatMap(day=>day.stops.map(stop=>[stop.id,{date:day.date,time:stop.start}]));
    const current=new Map(scheduled.reverse());
    const pinned=new Set(state.requiredServices.map(place=>place.id));
    const available=state.result.places;
    const missing=state.requiredServices.filter(place=>!available.some(item=>item.id===place.id));
    const places=[...available,...missing].filter(place=>
      (serviceView.kind==='all' || serviceView.kind===place.kind) && (!serviceView.city || serviceView.city===place.city) &&
      [place.name,place.en,place.cn,...(place.aliases??[])].some(label=>folded(label).includes(query)));
    places.sort((a,b)=>Number(pinned.has(b.id))-Number(pinned.has(a.id)) ||
      Number(current.has(b.id))-Number(current.has(a.id)) || name(a).localeCompare(name(b),getLocale()));
    const visible=places.slice(0,serviceView.limit);
    const filtered=Boolean(query || serviceView.kind!=='all' || serviceView.city);
    list.innerHTML=visible.length ? '<p class="caption">'+tr('Найдено · {count}',{count:formatNumber(places.length)})+
      '</p><ul class="composer-service-list">'+visible.map((place,index)=>{
      const mandatory=pinned.has(place.id);
      const city=state.result.locations?.find(location=>location.name===place.city);
      const when=current.get(place.id);
      const info=[t(kind[place.kind]),city?name(city):place.city,mandatory?t('Обязательный выбор'):'',
        when?t('В расписании · {when}',{when:formatDate(when.date)+' · '+when.time}):mandatory?t('Нет времени в расписании'):'',
        accessEvidence(state.result.settings.access,place)].filter(Boolean);
      const infoId='draft-venue-info-'+index;
      const venueId='draft-venue-name-'+index;
      const link=place.officialUrl??place.url;
      const title=name(place);
      const media=venueMedia(place,title);
      const mediaLinks=[media.credit,media.gallery].filter(Boolean).join(' · ');
      return '<li><div class="composer-service-card">'+(media.image||'')+'<div class="composer-service-copy">'+
        (link?'<a id="'+venueId+'" target="_blank" rel="noopener noreferrer" href="'+safe(link)+'" data-source-text>'+safe(title)+
        '</a>':'<strong id="'+venueId+'" data-source-text>'+safe(title)+'</strong>')+'<p class="caption" id="'+infoId+'">'+safe(info.join(' · '))+
        '</p>'+(mediaLinks?'<p class="caption composer-media-links">'+mediaLinks+'</p>':'')+
        '</div></div><button type="button" class="button-quiet" aria-describedby="'+venueId+' '+infoId+'" data-composer="'+
        (mandatory?'service-release':'service-include')+'" data-value="'+safe(place.id)+'"'+(pending || state.dirty?' disabled':'')+'>'+
        tr(mandatory?'Убрать из обязательных':'Включить в маршрут')+'</button></li>';
    }).join('')+'</ul>'+(places.length>visible.length?'<button type="button" class="button-quiet" data-composer="service-more">'+
      tr('Показать ещё')+'</button>':'') :
      '<p class="caption">'+tr(filtered?'По этому запросу ничего не найдено.':'В каталоге пока нет мест для этого маршрута.')+'</p>'+
      (filtered?'<button type="button" class="button-quiet" data-composer="service-clear">'+tr('Сбросить фильтры')+'</button>':'');
  }
  function start(label, feedback, refining=false) {
    const progress=feedback?.querySelector('.composer-swap-progress')??find('#composer-progress');
    const request={controller:new AbortController(),startedAt:Date.now(),progress,feedback,refining};
    pending=request;
    request.timer=setInterval(()=>updateAiWait(progress,request.startedAt),1000);
    showNote('');
    if (feedback) feedback.querySelector('.composer-swap-status').textContent='';
    phase(label);
    syncActions();
    return request;
  }
  function finish(request) {
    if (pending!==request) return;
    clearInterval(request.timer);
    pending=null;
    if (!mounted) return;
    const node=request.progress;
    node.hidden=true;
    node.replaceChildren();
    syncActions();
  }
  const isCurrent = (request,revision)=>mounted && pending===request && state.revision===revision;
  const visibleDays=()=>state.result.plan.days.map((day,index)=>({day,index})).filter(({index})=>
    state.mapDay==='all' || String(index)===state.mapDay);
  const mapIsVisible=()=>workView==='map' || (workView==='schedule' && mapVisibility.matches);
  function paintMapStop() {
    const panel=find('#draft-map-stop');
    const day=state.result.plan.days[state.pointDay];
    const stop=day?.stops.find(item=>item.id===state.point);
    panel.hidden=workView!=='map' || !stop;
    if (panel.hidden) return;
    panel.innerHTML='<span><time>'+safe(stop.start)+'</time> <strong data-source-text>'+safe(name(stop))+'</strong></span>'+
      '<button type="button" class="link-button" data-composer="map-stop">'+tr('Открыть в программе')+'</button>';
  }
  function paintMap(frame=false) {
    if (!mapIsVisible() || !state.result) return;
    paintMapStop();
    if (!map) {
      map=createRouteMap(find('#draft-map'),{locale:getLocale(),minZoom:0,zoomPosition:'topright',onSelect(id,_place,context){
        if (pending?.feedback) {pending.controller.abort();finish(pending);}
        state.point=id;
        const day=context?.dayIndex;
        const days=state.result.plan.days;
        state.pointDay=Number.isInteger(day) && days[day]?.stops.some(stop=>stop.id===id) ? day :
          days.findIndex(item=>item.stops.some(stop=>stop.id===id));
        if (workView==='map') {paintMapStop();return;}
        paintDays();
        find('#draft-timeline button[aria-pressed=true]')?.focus();
      }});
    } else if (frame) map.resize();
    const {plan,places}=state.result;
    const days=visibleDays();
    const included=new Set(days.flatMap(({day})=>day.stops.map(stop=>stop.id)));
    const mapDays=days.map(({day})=>state.mapDay!=='all' && day.stops.length ? {...day,transfer:undefined} : day);
    map.update({places:places.filter(place=>included.has(place.id)),route:{...plan,days:mapDays},selectedId:state.point,
      dayIndex:state.mapDay==='all'?0:Number(state.mapDay),geodata:localizedGeodata,
      frame:frame?'route':false,base:'streets',locale:getLocale(),showPlaces:true,
      groupByCity:state.mapDay==='all' && (state.result.locations?.length ?? 1)>1});
  }
  function selectWorkView(next) {
    const prior=workView;
    workView=next;
    workspace.view=next;
    find('.planner-workarea').dataset.view=next;
    for (const tab of container.querySelectorAll('[data-composer=workspace-view]')) {
      tab.setAttribute('aria-pressed',String(tab.dataset.value===next));
    }
    if (prior!==next && (next==='map' || next==='schedule')) paintMap(true);
  }
  function syncMapLayout() {
    if (find('.planner-workarea')) paintMap(true);
  }
  function paintDays(frame=false) {
    const {plan,places} = state.result;
    const byId=new Map(places.map(place=>[place.id,place]));
    const days=visibleDays();
    const region=find('#draft-days');
    const compact=plan.days.length>7;
    const dayOptions=[['all',t('Все дни')],...plan.days.map((day,index)=>[
      String(index),t('День {day}',{day:formatNumber(index+1)})+(compact?' · '+formatDate(day.date):''),
    ])];
    region.innerHTML=compact ? '<label class="field composer-day-select">'+tr('День маршрута')+'<select id="draft-day-select">'+
      dayOptions.map(([key,label])=>'<option value="'+key+'"'+(state.mapDay===key?' selected':'')+'>'+safe(label)+'</option>').join('')+
      '</select></label>' : dayOptions.map(([key,label])=>'<button class="atlas-option" type="button" data-composer="day" data-value="'+
      key+'" aria-pressed="'+(state.mapDay===key)+'">'+safe(label)+'</button>').join('');
    find('#draft-timeline').innerHTML = days.map(({day,index})=>'<section class="composer-day"><h3>'+tr('День {day}',{day:index+1})+
      ' · '+safe(formatDate(day.date))+(state.result.locations?.length>1?' · '+safe(name(state.result.locations.find(city=>city.id===day.cityId)??{name:day.city})): '')+
      '</h3>'+(themes[day.focus?.theme]?'<p class="composer-day-focus">'+tr(themes[day.focus.theme])+'</p>':'')+
      transferMarkup(day,state.result)+
      '<ul class="composer-stops">'+day.stops.map(stop=>{
        const selected=state.point===stop.id && state.pointDay===index;
        const place=byId.get(stop.id);
        const role=stop.type==='food'?'Обед':stop.type==='stay'?'Ночёвка':null;
        const notes=[role && t(role),stop.required && t('Обязательная остановка'),accessEvidence(plan.settings.access,place)].filter(Boolean).join(' · ');
        return '<li><button type="button" data-composer="stop" data-value="'+safe(stop.id)+'" data-day="'+index+'" aria-pressed="'+selected+'">'+
          '<time>'+safe(stop.start)+'–'+safe(stop.end)+'</time><span data-source-text>'+safe(name(stop))+'</span>'+
          (notes?'<small>'+safe(notes)+'</small>':'')+'</button>'+
          (selected?'<div class="composer-stop-actions"><a href="'+safe(stop.url)+'" target="_blank" rel="noopener noreferrer">'+tr('Источник сведений об объекте')+'</a>'+
            '<button type="button" class="link-button" data-composer="locate-stop" data-value="'+safe(stop.id)+'">'+tr('Показать на карте')+'</button>'+
            (place?.officialUrl && place.officialUrl!==stop.url?
              '<a href="'+safe(place.officialUrl)+'" target="_blank" rel="noopener noreferrer">'+tr('Официальный сайт объекта')+'</a>':'')+
            (stop.leg?.minutes?'<span class="caption">'+tr('Переезд к точке · около {minutes} мин, {distance} км по прямой',{
              minutes:formatNumber(stop.leg.minutes),distance:formatNumber(stop.leg.distanceKm)})+'</span>':'')+
            (stop.openingHours?'<span class="caption">'+tr('Опубликованные часы · {opens}–{closes}',stop.openingHours)+'</span>':'')+
            '<span class="caption">'+tr('Условия для группы нужно подтвердить')+'</span>'+
            (stop.required?'':'<button type="button" class="link-button" data-composer="pin-stop" data-value="'+safe(stop.id)+'">'+tr('Сделать обязательным')+'</button>')+
            '<button type="button" class="link-button" data-composer="omit-stop" data-value="'+safe(stop.id)+'">'+tr('Исключить точку')+'</button>'+
            replacementMarkup(stop,byId,plan.settings,state.dirty)+'</div>':'')+'</li>';
      }).join('')+
      '</ul>'+(day.logistics?.arrivalAfterDay?'':weatherSlot(index,{compact:true}))+
      (day.missing.some(gap=>serviceGaps.has(gap))?'<button type="button" class="link-button composer-missing-services" data-composer="open-venues">'+
        tr('Не подобрано · {items}',{items:day.missing.filter(gap=>serviceGaps.has(gap)).map(gap=>t(serviceGaps.get(gap))).join(', ')})+'</button>':'')+
      dayGaps({...day,missing:day.missing.filter(gap=>!serviceGaps.has(gap))}).map(gap=>'<p class="caption">'+safe(gap)+'</p>').join('')+'</section>').join('');
    loadPlanWeather(find('#draft-timeline'),forecastDays(state.result,state.dirty),api);
    paintMap(frame);
    saveWorkspaceDraft();
  }
  function resultMarkup(focus=false) {
    if (!mounted) return;
    map?.destroy();
    map=null;
    if (!state.result) return;
    if (serviceView.city && !state.result.locations?.some(place=>place.name===serviceView.city)) serviceView.city='';
    const {geodata}=state.result;
    localizedGeodata={...geodata,attribution:geodata.attribution?.map(credit=>({...credit,label:t(credit.label)}))};
    find('#composer-result').innerHTML=draftMarkup(state.result,serviceView,state);
    paintDraftNavigation();
    paintRequiredPlaces();
    selectWorkView(workView);
    paintServices();
    setEditor(state.dirty);
    paintDays(true);
    loadPlanWeather(find('#draft-day-risks'),forecastDays(state.result,state.dirty).map(day => ({ ...day, alternative:null })),api);
    if (focus) {
      find('#draft-title').focus({preventScroll:true});
      find('.composer-title').scrollIntoView({block:'start'});
    }
    if (state.dirty) find('#draft-status').textContent=t('Параметры изменились. Соберите черновик заново.');
  }
  function chooseDay(value) {
    if (!state.result || value===state.mapDay) return;
    if (pending?.feedback) {pending.controller.abort();finish(pending);}
    state.mapDay=value;
    state.point=null;
    state.pointDay=null;
    paintDays(true);
    (find('#draft-day-select')??find('#draft-days [aria-pressed=true]'))?.focus({preventScroll:true});
  }
  function settingsFrom(form) {
    const fields=new FormData(form);
    return {date:fields.get('date'),days:Number(fields.get('days')),size:Number(fields.get('size')),interests:fields.getAll('interest'),
      excludedInterests:fields.getAll('excludedInterest'),
      theme:fields.getAll('interest')[0]??'any',transport:fields.get('transport'),pace:fields.get('pace'),
      market:fields.has('china')?'zh':'ru',access:fields.has('access'),visitDeadline:fields.get('visitDeadline')||null,
      required:[...new Set(String(fields.get('required')).split(/[,，;]/u).map(name=>name.trim()).filter(Boolean))]};
  }
  function setDirty() {
    state.revision+=1;
    if (!state.result) return;
    markStale();
    showNote('Параметры изменились. Соберите черновик заново.');
  }
  function markStale() {
    state.dirty=true;
    const output=find('.composer-output');
    if (output) {
      output.dataset.dirty='true';
      output.querySelector('.composer-stale').hidden=false;
    }
    const send=find('[data-composer=export]');
    if (send) send.disabled=true;
    syncActions();
  }
  function durationIssue() {
    const min=MIN_DRAFT_DAYS;
    const max=MAX_DRAFT_DAYS;
    if (state.unsupportedDays!=null) return {field:'days',message:'Запрошено дней: {days}. Выберите от {min} до {max}.',
      values:{days:formatNumber(state.unsupportedDays),min,max}};
    if (!isDraftDuration(state.settings.days)) return {field:'days',message:'Выберите длительность от {min} до {max} дней.',values:{min,max}};
    if (state.selectedCity && state.extraCities.length>=state.settings.days) return {field:'days',
      message:'Городов больше, чем дней. Уберите лишние города или увеличьте длительность.'};
    return null;
  }
  function clearRequestedDuration() {
    if (state.unsupportedDays!=null) {
      if (!isDraftDuration(state.settings.days)) state.settings.days=initialRequirements(currentDate()).days;
      find('#draft-input').elements.days.value=state.settings.days;
    }
    state.unsupportedDays=null;
  }
  function parameterIssue() {
    if (state.invalidDate) return {field:'date',message:'В запросе неверная дата {value}. Исправьте её в запросе или укажите дату в параметрах.',values:{value:state.invalidDate}};
    if (state.invalidSize) return {field:'size',message:'В запросе {value} чел. Укажите размер группы от 1 до 100 человек.',values:{value:state.invalidSize}};
    return durationIssue();
  }
  function applyParsing(result,message) {
    const {parsed,cities}=result;
    const resultSettings=initialRequirements(result.referenceDate ?? currentDate());
    for (const key of ['date','size','transport','pace','market','access','visitDeadline']) if (parsed[key]!=null) resultSettings[key]=parsed[key];
    if (isDraftDuration(parsed.days)) resultSettings.days=parsed.days;
    resultSettings.interests=parsed.interests;
    resultSettings.required=parsed.required;
    resultSettings.excludedInterests=parsed.excludedInterests??[];
    for (const key of state.overrideFields) delete resultSettings[key];
    state.settings={...state.settings,...resultSettings};
    state.lastAppliedBrief=state.brief.trim();
    state.unsupportedDays=!state.overrideFields.includes('days') && !isDraftDuration(parsed.days) ? parsed.requestedDays ?? parsed.days ?? null : null;
    state.invalidDate=state.overrideFields.includes('date') ? null : parsed.invalidDate ?? null;
    state.invalidSize=state.overrideFields.includes('size') ? null : parsed.invalidSize ?? null;
    if (!state.overrideFields.includes('city') && (cities.length || !state.selectedCity)) {
      const previousIds=[state.selectedCity,...state.extraCities].filter(Boolean).map(city=>city.id).join(',');
      if (previousIds!==cities.map(city=>city.id).join(',')) {
        state.omitted=[];
        state.replacements=[];
        state.requiredServices=state.requiredServices.filter(place=>cities.some(city=>city.name===place.city));
      }
      clearTimeout(searchTimer);
      state.findVersion++;
      state.cities=cities;
      state.selectedCity=cities[0]??null;
      state.extraCities=cities.slice(1);
      state.query=state.selectedCity ? name(state.selectedCity) : '';
    }
    if (state.result) markStale();
    saveWorkspaceDraft();
    const issue=parameterIssue();
    state.note = issue?.message ?? (
      state.extraCities.length>2 ? 'Укажите до трёх городов для одного маршрута.' :
      state.extraCities.length && !state.overrideFields.includes('city') ? 'Несколько городов найдено в тексте. Проверьте порядок.' : message);
    state.noteValues=issue?.values ?? null;
    updateExtraction();
    paintRequiredPlaces();
  }
  async function analyse() {
    if (pending || state.brief.trim().length<3) return;
    const request=start('ИИ уточняет условия…',null,true);
    const revision=state.revision;
    try {
      const deep=await api('brief',{text:state.brief.trim(),mode:'ai'},'POST',{signal:request.controller.signal});
      if (isCurrent(request,revision)) {
        applyParsing(deep,deep.mode==='ai'?'ИИ разобрал запрос. Проверьте поля.':
          deep.mode==='busy'?'ИИ занят. Параметры заполнены из запроса.':
          'Параметры заполнены автоматически. ИИ сейчас недоступен.');
        find('#draft-parameters').open=true;
      }
    } catch(error) {
      if (isCurrent(request,revision)) showNote(error.message);
    } finally {
      finish(request);
    }
  }
  async function compareDates(feedback) {
    if (pending || state.dirty || !state.result) return;
    const request=start('Пересчитываем расписание на ближайшие даты…',feedback);
    const revision=state.revision;
    try {
      const result=await api('draft-dates',{...state.result.settings,replacements:state.replacements},'POST',{signal:request.controller.signal});
      if (!isCurrent(request,revision)) return;
      feedback.querySelector('#draft-date-options').innerHTML=draftDateOptions(result);
      feedback.querySelector('.composer-swap-status').textContent=t('После выбранной даты проверено {count} вариантов.',{
        count:formatNumber(result.datesChecked)});
    } catch(error) {
      if (isCurrent(request,revision)) feedback.querySelector('.composer-swap-status').textContent=t(error.message);
    } finally {
      finish(request);
    }
  }
  async function build(form,replacement,feedback,selectedServices,serviceChange) {
    if (loadingCity || pending) return;
    const brief=state.brief.trim();
    const parseNew = brief.length>=3 && brief!==state.lastAppliedBrief;
    const request=start(selectedServices?'Пересчитываем маршрут с выбранным местом…':replacement?'Проверяем замену для этого времени…':
      parseNew?'Смотрим даты, группу и города в запросе…':'Подбираем объекты и составляем программу…',feedback);
    const revision=++state.revision;
    const network={signal:request.controller.signal};
    try {
      if (parseNew) {
        const fast=await api('brief',{text:brief,mode:'rules'},'POST',network);
        if (!isCurrent(request,revision)) return;
        applyParsing(fast,'');
      }
      const issue=parameterIssue();
      if (issue || state.extraCities.length>2) {
        find('#draft-parameters').open=true;
        showNote(issue?.message ?? 'Укажите до трёх городов для одного маршрута.',issue?.values);
        (issue ? form.elements[issue.field] : find('#draft-additional-cities button'))?.focus();
        return;
      }
      if (!state.selectedCity && state.query.trim()) {
        const response=await api('cities?q='+encodeURIComponent(state.query),undefined,'GET',network);
        if (!isCurrent(request,revision)) return;
        state.cities=response.cities;
        const possible=state.cities.filter(city=>[city.name,city.en,city.cn,...(city.aliases??[])].some(value=>value?.toLowerCase()===state.query.trim().toLowerCase()));
        if (possible.length===1) state.selectedCity=possible[0];
        if (mounted) cityOptions(true);
      }
      if (!state.selectedCity) {
        find('#draft-parameters').open=true;
        showNote('Измените запрос или откройте параметры и выберите город.');
        (find('#city-id')??find('#city-query')).focus();
        return;
      }
      if (!form.checkValidity()) {
        find('#draft-parameters').open=true;
        find('#draft-advanced').open=true;
        form.reportValidity();
        return;
      }
      state.settings=settingsFrom(form);
      if (state.settings.required.length>10) {
        find('#draft-parameters').open=true;
        find('#draft-advanced').open=true;
        showNote('Можно выбрать до 10 обязательных объектов. Уберите лишние из списка.');
        form.elements.required.focus();
        return;
      }
      const duration=durationIssue();
      if (duration) {
        find('#draft-parameters').open=true;
        showNote(duration.message,duration.values);
        form.elements.days.focus();
        return;
      }
      if (parseNew) phase('Подбираем объекты и составляем программу…');
      const replacements=replacement ? [...state.replacements,replacement] : state.replacements;
      const cities=[state.selectedCity,...state.extraCities];
      const services=(selectedServices ?? state.requiredServices).filter(place=>cities.some(city=>city.name===place.city));
      const result=await api('draft',{...state.settings,cityId:state.selectedCity.id,additionalCityIds:state.extraCities.map(city=>city.id),
        omittedIds:state.omitted.map(place=>place.id),replacements,requiredPlaceIds:services.map(place=>place.id)},'POST',network);
      if (!isCurrent(request,revision)) return;
      const swaps=result.plan.replacements??[];
      const rejected=swaps.some(item=>item.status==='rejected') || swaps.length!==replacements.length;
      if (replacement && rejected) {
        feedback.querySelector('.composer-swap-status').textContent=t('Замену не удалось поставить на то же время. Программа сохранена.');
        return;
      }
      state.replacements=swaps.filter(item=>item.status==='applied').map(({day,fromId,toId})=>({day,fromId,toId}));
      state.requiredServices=services;
      state.result=result;
      if (!resume && location.hash!=='#route?draft=1') {
        history.replaceState(history.state,'','#route?draft=1');
        workspace.hash=location.hash;
      }
      if (!replacement && !selectedServices) {
        workView='schedule';
        state.mapDay='0';
      }
      state.point=replacement?.toId??null;
      state.pointDay=replacement?.day??null;
      state.dirty=false;
      showNote(rejected?'Часть прежних замен больше не подходит к новым параметрам. Проверьте расписание.':'');
      resultMarkup(!replacement && !selectedServices);
      if (replacement && workView==='schedule') find('#draft-timeline button[aria-pressed=true]')?.focus();
      if (serviceChange) {
        const selection=result.plan.required.find(item=>item.requestedId===serviceChange);
        const status=selection ? (selection.scheduled ? 'Маршрут пересчитан. Проверьте время выбранного места.' :
          'Маршрут пересчитан. Для выбранного места нет подходящего времени.') : 'Снято требование включить это место.';
        find('.composer-service-feedback .composer-swap-status').textContent=t(status);
      }
    } catch(error) {
      if (isCurrent(request,revision)) {
        if (feedback) feedback.querySelector('.composer-swap-status').textContent=t(error.message);
        else showNote(error.message);
      }
    } finally {
      finish(request);
      if (serviceChange && mounted && state.revision===revision && workView==='venues') {
        const target=[...container.querySelectorAll('#draft-service-list button[data-value]')]
          .find(button=>button.dataset.value===serviceChange);
        (target??find('#draft-service-title'))?.focus();
      }
    }
  }
  const submit = event=>{
    const form=event.target;
    if (form.id!=='draft-input') return;
    event.preventDefault();
    if (pending?.refining) {
      pending.controller.abort();
      finish(pending);
    }
    void build(form);
  };
  const input = event=>{
    const control=event.target;
    if (control.id==='draft-day-select') {
      chooseDay(control.value);
      return;
    }
    if (control.id==='extra-city-query') {
      searchAdditionalCity(control.value.trim());
      return;
    }
    if (control.id==='draft-service-query' || control.id==='draft-service-kind' || control.id==='draft-service-city') {
      serviceView.query=find('#draft-service-query').value;
      serviceView.kind=find('#draft-service-kind').value;
      serviceView.city=find('#draft-service-city')?.value??'';
      serviceView.limit=8;
      paintServices();
      return;
    }
    if (control.form?.id!=='draft-input') return;
    if (pending) {
      pending.controller.abort();
      finish(pending);
      showNote('Входные данные изменились. Запустите расчёт снова.');
    }
    if (control.name==='brief') {
      state.brief=control.value;
      clearRequestedDuration();
      state.invalidDate=null;
      state.invalidSize=null;
      setDirty();
      showNote(state.note,state.noteValues);
      showDefaults();
      syncActions();
      saveWorkspaceDraft();
      return;
    }
    const manual=({china:'market',interest:'interests',excludedInterest:'excludedInterests'})[control.name] ||
      control.name || (control.id.startsWith('city-')?'city':'');
    if (manual && !state.overrideFields.includes(manual)) state.overrideFields.push(manual);
    if (control.name==='days') state.unsupportedDays=null;
    if (control.name==='date') state.invalidDate=null;
    if (control.name==='size') state.invalidSize=null;
    setDirty();
    if (control.id==='city-query') {
      state.query=control.value;
      state.selectedCity=null;
      state.cities=[];
      cityOptions();
      clearTimeout(searchTimer);
      const version=++state.findVersion;
      if (state.query.trim().length<2) {showDefaults();return;}
      searchTimer=setTimeout(async()=>{
        try {
          const result=await api('cities?q='+encodeURIComponent(state.query));
          if (mounted && state.findVersion===version) {state.cities=result.cities;cityOptions(true);}
        } catch(error) {if (mounted) find('#draft-status').textContent=t(error.message);}
      },250);
    }
    if (control.id==='city-id') {
      const previous=state.selectedCity;
      state.selectedCity=state.cities.find(city=>city.id===control.value)??null;
      if (state.extraCities.some(city=>city.id===state.selectedCity?.id)) {
        state.extraCities=state.extraCities.flatMap(city=>city.id===state.selectedCity.id ? previous?[previous]:[] : [city]);
        cityOptions();
        find('#city-id')?.focus();
      }
      if (state.selectedCity) state.query=find('#city-query').value=name(state.selectedCity);
      syncAdditionalCitiesControl();
    }
    state.settings=settingsFrom(find('#draft-input'));
    if (control.name==='days' || control.id.startsWith('city-')) showNote(state.note,state.noteValues);
    showDefaults();
    saveWorkspaceDraft();
  };
  const click = event=>{
    if (event.target.closest('[data-action=cancel-composer]') && pending) {
      const feedback=pending.feedback;
      pending.controller.abort();
      finish(pending);
      if (feedback) {
        feedback.querySelector('.composer-swap-status').textContent=t('Запрос отменён. Введённые параметры сохранены.');
        (feedback.closest('details')?.querySelector('summary')??find('#draft-service-title'))?.focus();
      } else {
        showNote('Запрос отменён. Введённые параметры сохранены.');
        find('#draft-input [type=submit]').focus();
      }
      return;
    }
    const button=event.target.closest('[data-composer]');
    if (!button) return;
    const {composer:action,value}=button.dataset;
    if (action==='remove-required') {
      if (pending) {pending.controller.abort();finish(pending);}
      state.requiredServices=state.requiredServices.filter(place=>place.id!==value);
      setDirty();
      paintRequiredPlaces();
      saveWorkspaceDraft();
      (find('#draft-context-places button') ?? find('[name=brief]')).focus();
      return;
    }
    if (action==='edit-editor' || action==='close-editor') {
      const open=action==='edit-editor' && find('#planner-editor').hidden;
      if (!open && pending && !pending.feedback) return;
      setEditor(open);
      if (open) {
        const parameters=find('#draft-parameters');
        parameters.open=true;
        parameters.querySelector('summary').focus();
      } else find('[data-composer=edit-editor]').focus();
      return;
    }
    if (action==='workspace-view' || action==='open-venues') {
      if (action==='open-venues') {
        if (value === 'food' || value === 'stay') {
          const city = find('#draft-service-city');
          find('#draft-service-query').value = '';
          find('#draft-service-kind').value = value;
          if (city) city.value = button.dataset.city || '';
          Object.assign(serviceView,{query:'',kind:value,city:city?.value ?? '',limit:8});
          paintServices();
        }
        selectWorkView('venues');
        find('#draft-service-title').focus();
      } else {
        const fromMap=workView==='map' && value==='schedule';
        selectWorkView(value);
        if (fromMap) paintDays();
      }
      return;
    }
    if (action==='refine') {void analyse();return;}
    if (pending && (['example','remove-city','restore-stop','pin-stop','omit-stop'].includes(action) ||
        (pending.feedback && ['stop','weather-alternatives'].includes(action)))) {
      pending.controller.abort();
      finish(pending);
    }
    if (action==='example') {
      const input = find('[name=brief]');
      input.value=examples[Number(value)][1][{ru:0,en:1,zh:2}[getLocale()]];
      state.brief=input.value;
      clearRequestedDuration();
      state.invalidDate=null;
      state.invalidSize=null;
      state.overrideFields=[];
      setDirty();
      showNote(state.note,state.noteValues);
      showDefaults();
      syncActions();
      saveWorkspaceDraft();
      input.focus();
      return;
    }
    if (action==='remove-city') {
      state.extraCities=state.extraCities.filter(city=>city.id!==value);
      if (!state.overrideFields.includes('city')) state.overrideFields.push('city');
      cityOptions();
      setDirty();
      showNote(state.note,state.noteValues);
      showDefaults();
      saveWorkspaceDraft();
      (find('#draft-additional-cities button')??find('#draft-add-city summary')).focus();
      return;
    }
    if (action==='add-city') {
      const city=extraMatches.find(item=>item.id===value);
      if (!city || !state.selectedCity || pending || state.extraCities.length>=2 ||
          state.selectedCity.id===city.id || state.extraCities.some(item=>item.id===city.id)) return;
      state.extraCities.push(city);
      if (!state.overrideFields.includes('city')) state.overrideFields.push('city');
      const query=find('#extra-city-query');
      query.value='';
      searchAdditionalCity('');
      cityOptions();
      setDirty();
      showNote(state.note,state.noteValues);
      showDefaults();
      saveWorkspaceDraft();
      (find('#draft-add-city').hidden?find('#draft-additional-cities li:last-child button'):query)?.focus();
      return;
    }
    if (action==='restore-stop') {
      state.omitted=state.omitted.filter(place=>place.id!==value);
      cityOptions();
      setDirty();
      saveWorkspaceDraft();
      (find('#draft-omitted button')??find('#draft-input [type=submit]')).focus();
      return;
    }
    if (!state.result) return;
    if (action==='compare-dates') {
      void compareDates(button.closest('.draft-date-feedback'));
      return;
    }
    if (action==='use-date' && !state.dirty && !pending) {
      const form=find('#draft-input');
      form.elements.date.value=value;
      form.elements.date.dispatchEvent(new Event('input',{bubbles:true}));
      setEditor(true);
      void build(form,null,button.closest('.draft-date-feedback'));
      return;
    }
    if (action==='service-more') {
      const previous=serviceView.limit;
      serviceView.limit+=8;
      paintServices();
      container.querySelectorAll('.composer-service-list li button')[previous]?.focus();
      return;
    }
    if (action==='service-clear') {
      find('#draft-service-query').value=serviceView.query='';
      find('#draft-service-kind').value=serviceView.kind='all';
      const cityField=find('#draft-service-city');
      if (cityField) cityField.value=serviceView.city='';
      serviceView.limit=8;
      paintServices();
      find('#draft-service-query').focus();
      return;
    }
    if (action==='service-include' || action==='service-release') {
      if (pending || state.dirty) return;
      const place=(action==='service-include'?state.result.places:state.requiredServices)
        .find(item=>item.id===value);
      if (!place) return;
      const services=state.requiredServices.filter(item=>item.id!==value);
      if (action==='service-include') services.push({id:place.id,name:place.name,en:place.en,cn:place.cn,kind:place.kind,city:place.city});
      const feedback=find('.composer-service-feedback');
      if (services.length>10) feedback.querySelector('.composer-swap-status').textContent=t('Можно выбрать до 10 обязательных объектов. Уберите лишние из списка.');
      else void build(find('#draft-input'),null,feedback,services,value);
      return;
    }
    if (action==='day') chooseDay(value);
    if (action==='fit') map?.fit({routeOnly:true});
    if (action==='map-stop') {
      selectWorkView('schedule');
      paintDays();
      find('#draft-timeline button[aria-pressed=true]')?.focus();
      return;
    }
    if (action==='locate-stop') {
      selectWorkView('map');
      map?.select(value,{focus:true});
      find('[data-composer=workspace-view][data-value=map]')?.focus();
      return;
    }
    if (action==='stop' || action==='weather-alternatives') {
      if (action==='weather-alternatives' && state.dirty) {
        showNote('Параметры изменились. Соберите черновик заново.');
        setEditor(true);
        find('#draft-input [type=submit]').focus();
        return;
      }
      state.point=value;
      state.pointDay=Number(button.dataset.day);
      paintDays();
      map?.select(value,{focus:true});
      const alternatives = action==='weather-alternatives' ? find('.composer-alternatives') : null;
      if (alternatives) {
        alternatives.open=true;
        alternatives.querySelector('summary')?.focus();
      } else find('#draft-timeline button[aria-pressed=true]')?.focus({preventScroll:true});
    }
    if (action==='export' && !state.dirty) download(state.result,state.requiredServices);
    if (action==='replace-stop') {
      const previousId=button.dataset.previous;
      const candidate=state.result.plan.days[state.pointDay]?.stops.find(stop=>stop.id===previousId)?.alternatives?.find(place=>place.id===value);
      if (!candidate || state.dirty) return;
      void build(find('#draft-input'),{day:state.pointDay,fromId:previousId,toId:value},button.closest('details').querySelector('.composer-swap-feedback'));
    }
    if (action==='pin-stop'||action==='omit-stop') {
      const place=state.result.places.find(item=>item.id===value);
      if (!place) return;
      const form=find('#draft-input');
      setEditor(true);
      if (action==='pin-stop') {
        const input=form.elements.required;
        const fields=settingsFrom(form);
        const required=[...new Set([...fields.required,place.name])];
        if (required.length<=10) input.value=required.join(', ');
        else {
          find('#draft-advanced').open=true;
          find('#draft-parameters').open=true;
          showNote('Можно выбрать до 10 обязательных объектов. Уберите лишние из списка.');
          input.focus();
          return;
        }
        state.omitted=state.omitted.filter(item=>item.id!==place.id);
        find('#draft-advanced').open=true;
        find('#draft-parameters').open=true;
      } else if (!state.omitted.some(item=>item.id===place.id) && state.omitted.length<20) state.omitted.push(place);
      state.settings=settingsFrom(form);
      cityOptions();
      setDirty();
      saveWorkspaceDraft();
      const status=find('#draft-status');
      status.textContent=t('Чтобы учесть изменения, пересчитайте черновик.');
      form.querySelector('[type=submit]').focus();
    }
  };
  container.addEventListener('submit',submit);
  container.addEventListener('input',input);
  container.addEventListener('click',click);
  container.addEventListener('error',hideBrokenVenuePhoto,true);
  mapVisibility.addEventListener('change',syncMapLayout);
  cityOptions();
  showDefaults();
  paintDraftNavigation();
  paintRequiredPlaces();
  syncActions();
  resultMarkup();
  if (loadingCity) {
    const version=state.findVersion;
    showNote('Город загружается…');
    void api('cities?id='+cityId,undefined,'GET',{signal:initialCityController.signal}).then(({cities:[city]})=>{
      if (!mounted || state.findVersion!==version) return;
      if (!city) throw Error('City not found');
      Object.assign(state,{query:name(city),cities:[city],selectedCity:city,note:'',noteValues:null});
      if (/^[\p{L}\p{N}][\p{L}\p{N}_-]{0,79}$/u.test(placeId ?? '') && label && Object.hasOwn(kind,placeKind)) {
        state.requiredServices=[{id:placeId,name:label,kind:placeKind,city:city.name}];
      }
      updateExtraction();
      paintRequiredPlaces();
    }).catch(()=>{
      if (!mounted || state.findVersion!==version) return;
      find('#draft-parameters').open=true;
      showNote('Не удалось загрузить город. Выберите его в параметрах.');
    }).finally(()=>{
      loadingCity=false;
      if (mounted) syncActions();
    });
  }
  return {destroy(){
    mounted=false;
    initialCityController.abort();
    if (pending) {pending.controller.abort();finish(pending);}
    clearTimeout(searchTimer);
    clearTimeout(extraSearchTimer);
    mapVisibility.removeEventListener('change',syncMapLayout);
    map?.destroy();
    container.removeEventListener('submit',submit);
    container.removeEventListener('input',input);
    container.removeEventListener('click',click);
    container.removeEventListener('error',hideBrokenVenuePhoto,true);
  }};
}
