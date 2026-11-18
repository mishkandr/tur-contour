import { readFile } from 'node:fs/promises';

let catalog;

export async function getCityProjects(cityId) {
  catalog ??= readFile(new URL('./data/city-projects.json',import.meta.url),'utf8').then(JSON.parse);
  const {checkedAt,cities}=await catalog;
  const records=Object.hasOwn(cities,cityId) ? cities[cityId].map(record=>({...record,cityId})) : [];
  return {status:records.length?'published':'unavailable',records,checkedAt:records.length?checkedAt:null};
}
