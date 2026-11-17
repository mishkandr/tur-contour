import { readFile } from 'node:fs/promises';

const seasons = ['all', 'winter', 'spring', 'summer', 'autumn'];
const integerBetween = (value, low, high) => Number.isInteger(value) && value >= low && value <= high;
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function validDate(value) {
  return typeof value === 'string' && /^20\d{2}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

function parseSource(value) {
  if (typeof value !== 'string' || value.length > 500) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

export async function readVerifiedAudit(path, catalog, checkedAt) {
  const feed = JSON.parse(await readFile(path, 'utf8'));
  if (!isRecord(feed) || typeof feed.version !== 'string' || !feed.version.trim() || feed.version.length > 60 || !isRecord(feed.objects)) {
    throw new Error('Ожидается версия и список объектов по идентификаторам каталога');
  }
  const knownIds = new Set(catalog.map(place => place.id));
  const objectFields = Object.entries(feed.objects).map(([id, entry]) => {
    if (!knownIds.has(id) || !isRecord(entry)) throw new Error('Неизвестный объект или формат записи');
    const { capacity, language, minutes, hours, off, seasons: activeSeasons, access, booking, verifiedAt, validUntil } = entry;
    const sourceUrl = parseSource(entry.sourceUrl);
    const auditDate = typeof verifiedAt === 'string' ? verifiedAt.slice(0, 10) : '';
    if (!integerBetween(capacity, 1, 10000) || !integerBetween(minutes, 1, 720) ||
      !Array.isArray(hours) || hours.length !== 2 || !hours.every(hour => Number.isFinite(hour) && hour >= 0 && hour <= 24 && Number.isInteger(hour * 60)) || hours[0] >= hours[1] ||
      !Array.isArray(off) || !off.every(day => integerBetween(day, 0, 6)) ||
      !Array.isArray(activeSeasons) || !activeSeasons.length || !activeSeasons.every(season => seasons.includes(season)) ||
      !['interpreter', 'ru', null].includes(language) || ![true, false, null].includes(access) ||
      !['reservation', 'walk-in'].includes(booking) || !sourceUrl || !validDate(auditDate) ||
      !Number.isFinite(Date.parse(verifiedAt)) || Date.parse(verifiedAt) > Date.parse(checkedAt) ||
      !validDate(validUntil) || validUntil < auditDate) {
      throw new Error('Проверьте условия и подтверждение для объекта ' + id);
    }
    return [id, { capacity, language, minutes, hours, off: [...new Set(off)].sort(),
      seasons: [...new Set(activeSeasons)].sort(), access, booking, sourceUrl, verifiedAt, validUntil }];
  });
  return { version: feed.version.trim(), source: 'Подтверждённые условия', checkedAt, objects: Object.fromEntries(objectFields) };
}
