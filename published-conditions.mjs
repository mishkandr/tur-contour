const datePattern = /^20\d{2}-\d{2}-\d{2}$/;

export const publishedConditionFiles = [
  'published-vladimir.json', 'published-suzdal.json', 'published-hospitality.json', 'published-regional.json',
];

function isDate(value) {
  return typeof value === 'string' && datePattern.test(value) && Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;
}

function isUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

const hasText = value => typeof value === 'string' && Boolean(value.trim());
const isMinute = value => Number.isInteger(value) && value >= 0 && value <= 1440;

function isDay(windows) {
  return Array.isArray(windows) && windows.every((window, index) => Array.isArray(window) && window.length === 2 &&
    window.every(isMinute) && window[0] < window[1] && (index === 0 || window[0] >= windows[index - 1][1]));
}

function isSchedule(schedule) {
  const {url, validFrom, validUntil, weekly, overrides = {}, lastEntryMinutes = 0} = schedule;
  const inPeriod = date => !(validFrom && date < validFrom || validUntil && date > validUntil);
  const validWindows = windows => isDay(windows) && windows.every(([start, end]) => start <= end - lastEntryMinutes);
  return isUrl(url) && (!validFrom || isDate(validFrom)) && (!validUntil || isDate(validUntil)) &&
    (!validFrom || !validUntil || validFrom <= validUntil) && Number.isInteger(lastEntryMinutes) && lastEntryMinutes >= 0 &&
    Array.isArray(weekly) && weekly.length === 7 && weekly.every(validWindows) &&
    Object.entries(overrides).every(([date, windows]) => isDate(date) && inPeriod(date) && validWindows(windows));
}

function validate(id, entry) {
  const { schedule, booking, limits = [], notes = [], clarify, groupServices = [] } = entry;
  const isFact = fact => fact && isUrl(fact.url) && hasText(fact.text);
  const isRange = (value,upper) => Array.isArray(value) && value.length===2 &&
    value.every(item=>Number.isInteger(item) && item>=1 && item<=upper) && value[0]<=value[1];
  const isService = service=>service && isUrl(service.url) && isDate(service.checkedAt) &&
    ['ru','en','zh'].every(locale=>hasText(service.title?.[locale])) && isRange(service.size,1000) && isRange(service.minutes,1440);
  const isBooking = fact=>isFact(fact) && (fact.advanceDays===undefined || Number.isInteger(fact.advanceDays) &&
    fact.advanceDays>0 && isDate(fact.validFrom) && isDate(fact.validUntil) && fact.validFrom<=fact.validUntil && isUrl(fact.termsUrl));
  if ((schedule && !isSchedule(schedule)) || (booking && !isBooking(booking)) ||
    !Array.isArray(limits) || !limits.every(item => isFact(item) && (item.max === undefined || Number.isInteger(item.max) && item.max > 0)) ||
    !Array.isArray(notes) || !notes.every(isFact) || !Array.isArray(clarify) || !clarify.every(hasText) ||
    !Array.isArray(groupServices) || !groupServices.every(isService)) {
    throw new Error('Проверьте опубликованные условия объекта ' + id);
  }
}

export function mergePublishedConditions(catalog, feeds) {
  const known = new Set(catalog.map(item => item.id));
  const objects = {};
  for (const {checkedAt, objects:entries} of feeds) {
    if (!isDate(checkedAt)) throw new Error('Укажите дату сверки опубликованных условий');
    for (const [id, entry] of Object.entries(entries)) {
      if (!known.has(id) || Object.hasOwn(objects,id)) throw new Error('Неизвестный или повторный объект ' + id);
      validate(id,entry);
      objects[id] = {...entry,checkedAt};
    }
  }
  return objects;
}
