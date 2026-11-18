import { addLocaleMessages, getLocale, t } from '/locale.js';

addLocaleMessages([
  ['Кафе и рестораны','Cafés and restaurants','咖啡馆与餐厅'],
  ['Фото','Photo','照片'],
  ['Фото на сайте','Photos on venue website','官网照片'],
  ['Фото и источник','Photo and source','照片及来源'],
]);

const escape = value=>String(value ?? '').replace(/[&<>"']/gu,character=>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[character]);
const localPhoto = /^\/assets\/[a-z0-9][a-z0-9_-]{0,95}\.webp$/iu;

function httpsUrl(value) {
  if (typeof value!=='string') return null;
  try {
    const url=new URL(value);
    return url.protocol==='https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

const link = (url,label)=>'<a href="'+escape(url)+'" target="_blank" rel="noopener noreferrer">'+escape(label)+'</a>';

export function venueMedia(place, label) {
  if (!['food','stay'].includes(place?.kind)) return {};
  const galleryUrl=httpsUrl(place.galleryUrl);
  const gallery=galleryUrl ? link(galleryUrl,t('Фото на сайте')) : '';
  const media={gallery,detail:gallery};
  const photo=place.photo;
  if (!photo || typeof photo.src!=='string' || !localPhoto.test(photo.src)) return media;
  const sourceUrl=httpsUrl(photo.sourceUrl);
  const licenseUrl=httpsUrl(photo.licenseUrl);
  if (!sourceUrl || !licenseUrl || !photo.credit || !photo.license) return media;
  const view=photo.view?.[getLocale()] || photo.view?.en || photo.view?.ru || t('Фото');
  const alt=[view,label].filter(Boolean).join(' · ');
  const credit=link(sourceUrl,photo.credit)+' · '+link(licenseUrl,photo.license);
  const image='<img class="venue-photo" src="'+escape(photo.src)+'" alt="'+escape(alt)+
    '" width="480" height="360" loading="lazy" decoding="async">';
  return {...media,image,credit,detail:gallery || link(sourceUrl,t('Фото и источник'))};
}

export function hideBrokenVenuePhoto(event) {
  if (event.target.matches?.('.venue-photo')) event.target.hidden=true;
}
