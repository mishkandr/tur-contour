import { cityCatalog, getCity } from './nationwide.mjs';
import { regionForCity } from './regional-statistics.mjs';

const dayMs=86_400_000;

function weatherPoints(city,now) {
  const localDate=new Date(now).toLocaleDateString('sv-SE',{timeZone:city.timezone ?? 'Europe/Moscow'});
  const [latitude,longitude]=city.coordinates;
  return [0,1,2].map(offset=>({
    date:new Date(Date.parse(localDate)+offset*dayMs).toISOString().slice(0,10),
    latitude,longitude,
  }));
}

export function createLocalPlaceCatalog(catalog,mapData) {
  return {
    source:{id:'pilot-place-catalog',name:'Каталог ТурКонтура',
      url:'https://github.com/mishkandr/tur-contour/blob/dev/data/catalog.json',status:'snapshot'},
    places:catalog.flatMap(place=>{
      const location=mapData.places[place.id];
      if (!location?.coordinates) return [];
      const tags=[place.theme,...(place.formats ?? [])].filter(Boolean);
      return [{id:place.id,name:place.name,en:place.en,cn:place.cn,city:place.city,kind:place.kind,
        ...(place.aliases ? {aliases:place.aliases} : {}),
        coordinates:location.coordinates,geoUrl:location.source,url:place.url,officialUrl:place.url,
        status:'unknown',geoStatus:'mapped',tags}];
    }),
  };
}

export function createCityOverview({catalog,mapData,local=createLocalPlaceCatalog(catalog,mapData),
  weatherForecast,getCityProjects,now=Date.now,fetchImpl,recordCatalog}={}) {
  return async function getCityOverview(cityId,{includeWeather=true,includeCatalog=true,includeProjects=true}={}) {
    const city=await getCity(cityId);
    const [cityPlaces,region,weather,projects]=await Promise.all([
      cityCatalog(city,{fetchImpl,local,include:includeCatalog,recordCatalog}),regionForCity(city.id),
      includeWeather ? weatherForecast({points:weatherPoints(city,now())}) : null,
      includeProjects ? getCityProjects(city.id) : {status:'disabled',records:[],checkedAt:null},
    ]);
    for (const record of projects.records) {
      if (record.coordinates) cityPlaces.geodata.places[record.id]={coordinates:record.coordinates,source:record.url};
    }
    return {city,region,...cityPlaces,weather,projects,catalogScope:'city-and-nearby'};
  };
}
