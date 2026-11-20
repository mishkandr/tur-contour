import { readFile, writeFile } from 'node:fs/promises';
import { mergePublishedConditions, publishedConditionFiles } from '../published-conditions.mjs';
import { pilotDatasetCsv } from '../pilot-dataset.mjs';

const load = name => readFile(new URL('../data/'+name,import.meta.url),'utf8').then(JSON.parse);
const [catalog, references, feeds] = await Promise.all([
  load('catalog.json'), load('pilot-mag-references.json'), Promise.all(publishedConditionFiles.map(load)),
]);
const csv = pilotDatasetCsv(catalog,mergePublishedConditions(catalog,feeds),references);
await writeFile(new URL('../data/pilot-dataset.csv',import.meta.url),csv);
