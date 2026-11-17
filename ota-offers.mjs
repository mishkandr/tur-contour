const currency = 'RUB';

function normalize(source) {
  if (source.format === 'flat') {
    return source.records.map(({hotel,checkIn,guests,rateRub,rooms}) => ({
      id:hotel, date:checkIn, occupancy:guests, priceRub:rateRub, roomsListed:rooms,
    }));
  }
  if (source.format === 'nested') {
    return source.properties.flatMap(({id,offers}) => offers.filter(offer => offer.charge.currency === currency)
      .map(({arrival,occupancy,charge,listed}) => ({id,date:arrival,occupancy,priceRub:charge.amount,roomsListed:listed})));
  }
  throw new Error('Неизвестный формат учебной выгрузки предложений размещения');
}

function validDate(value) {
  return typeof value === 'string' && /^20\d{2}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0,10) === value;
}

function validOccupancy(value) {
  return Number.isInteger(value) && value >= 1 && value <= 6;
}

export function getDemoOffers(feed,{date,occupancy=2} = {}) {
  if (feed?.synthetic !== true || !Array.isArray(feed.exports)) {
    throw new Error('Для учебного сравнения нужна явно помеченная демонстрационная выгрузка');
  }
  const objects = new Map();
  const providers = feed.exports.map(source => {
    const rows = normalize(source).filter(item => item.date===date && item.occupancy===occupancy &&
      validDate(item.date) && validOccupancy(item.occupancy) && Number.isInteger(item.priceRub) && item.priceRub > 0 &&
      Number.isInteger(item.roomsListed) && item.roomsListed >= 0);
    for (const {id,priceRub,roomsListed} of rows) {
      if (!objects.has(id)) objects.set(id,{id,offers:[]});
      objects.get(id).offers.push({providerId:source.id,priceRub,roomsListed});
    }
    return {id:source.id,name:source.name,version:source.version,checkedAt:source.checkedAt,coverage:rows.length ? 'snapshot' : 'none'};
  });
  const stays = [...objects.values()];
  return {
    date:validDate(date) ? date : null, occupancy:validOccupancy(occupancy) ? occupancy : null, nights:1, currency, synthetic:true,
    coverage:providers.some(provider => provider.coverage==='snapshot') ? 'snapshot' : 'none', providers, objects:stays,
    availablePlaceCount:stays.filter(stay => stay.offers.some(offer => offer.roomsListed>0)).length,
    groupAvailability:'unconfirmed',
  };
}
