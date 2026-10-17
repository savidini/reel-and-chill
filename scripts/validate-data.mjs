import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const catalog = JSON.parse(readFileSync('public/data/catalog.json', 'utf8'));
const articles = JSON.parse(readFileSync('src/content/articles.json', 'utf8'));
const ids = key => new Set(catalog[key].map(x => x.id));
const fishIds = ids('fish'), locationIds = ids('locations'), equipmentIds = ids('equipment');
const allIds = new Set([...fishIds, ...locationIds, ...equipmentIds, ...ids('areas')]);
const checkRefs = (values, allowed, where) => values.forEach(id => assert(allowed.has(id), `${where}: unknown reference ${id}`));
assert.equal(catalog.schemaVersion, 1);
for (const key of ['fish', 'species', 'locations', 'areas', 'sizes', 'equipment', 'unlocks', 'achievements', 'cosmetics', 'lureTypes', 'lineTypes', 'reelTypes', 'techniques', 'rarities']) {
  assert.equal(ids(key).size, catalog[key].length, `${key}: duplicate identifiers`);
}
const countMap = { Fish: 'fish', Location: 'locations', Achievement: 'achievements', Key: 'unlocks' };
for (const [source, dest] of Object.entries(countMap)) assert.equal(catalog[dest].length, catalog.meta.coverage[source], `${source}: lost production entries`);
for (const [source, kind] of [['Rod', 'rod'], ['Lure', 'lure'], ['Boat', 'boat']]) assert.equal(catalog.equipment.filter(e => e.kind === kind).length, catalog.meta.coverage[source]);
for (const [source, kind] of [['Companion', 'companion'], ['AnglerSkin', 'angler'], ['AnglerHat', 'hat'], ['AnglerOutfit', 'outfit'], ['BoatVariant', 'boat-color']]) assert.equal(catalog.cosmetics.filter(e => e.kind === kind).length, catalog.meta.coverage[source]);
assert.equal(catalog.species.length, catalog.meta.speciesCount);
let assets = 0;
function checkImage(path) {
  const file = resolve('public', '.' + path);
  assert(file.startsWith(resolve('public') + '/'), `Unsafe path: ${path}`);
  assert(existsSync(file), `Missing artwork: ${path}`);
  const data = readFileSync(file);
  assert.equal(data.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `Invalid PNG: ${path}`);
  assets++;
  return data;
}
for (const period of ['dawn', 'day', 'dusk', 'night']) {
  const path = catalog.timeIcons?.[period];
  assert(path, `Missing time icon: ${period}`);
  const png = checkImage(path);
  assert.equal(png.readUInt32BE(16), 9, `${period}: unexpected icon width`);
  assert.equal(png.readUInt32BE(20), 7, `${period}: unexpected icon height`);
}
for (const key of ['fish', 'locations', 'areas', 'equipment', 'achievements', 'cosmetics']) {
  for (const row of catalog[key]) {
    assert(row.name?.length, `${key}/${row.id}: missing name`);
    checkRefs(row.unlockIds, ids('unlocks'), row.id);
    if (row.image) checkImage(row.image);
  }
}
for (const f of catalog.fish) {
  assert(f.image && f.conditions.length && f.sizes.length && f.preferredLures.length, `${f.id}: missing essential information`);
  checkRefs(f.locationIds, locationIds, f.id);
  checkRefs(f.sizes, ids('sizes'), f.id);
  checkRefs(f.preferredLures, ids('lureTypes'), f.id);
  if (f.preferredLine) checkRefs([f.preferredLine], ids('lineTypes'), f.id);
  assert(f.weight.min <= f.trophyWeight && f.trophyWeight <= f.weight.max);
  assert(f.trophyPercent >= 0 && f.trophyPercent <= 100);
  for (const c of f.conditions) {
    assert(locationIds.has(c.locationId));
    assert(f.locationIds.includes(c.locationId), `${f.id}: location metadata disagrees with actual spawn`);
    assert(c.sizes.length, `${f.id}: condition with no size`);
    checkRefs(c.sizes, new Set(f.sizes), `${f.id} spawn`);
    checkRefs(c.times, new Set(['dawn', 'day', 'dusk', 'night']), f.id);
    if (c.timeStatus === 'unrestricted') assert.equal(c.times.length, 4);
    if (c.timeStatus === 'unknown') assert.equal(c.times.length, 0);
    if (c.encounter === 'legendary') assert(f.legendary && c.percentRange[0] >= f.trophyPercent);
    assert(c.weightRange[0] <= c.weightRange[1]);
  }
  if (f.legendary) assert(f.legendName && f.conditions.some(c => c.encounter === 'legendary'), `${f.id}: incomplete legendary entry`);
}
for (const l of catalog.locations) {
  assert(ids('areas').has(l.areaId));
  checkRefs(l.fishIds, fishIds, l.id);
  if (l.kind !== 'pond') {
    const spawns = new Set(catalog.fish.filter(f => f.conditions.some(c => c.locationId === l.id)).map(f => f.id));
    assert.deepEqual([...spawns].sort(), [...l.fishIds].sort(), `${l.id}: location list differs from spawn membership`);
  }
}
for (const e of catalog.equipment) {
  checkRefs(e.sizes, ids('sizes'), e.id);
  if (e.kind === 'rod') { assert(e.strength?.length && e.length?.length); checkRefs([e.lineType], ids('lineTypes'), e.id); }
  if (e.kind === 'lure') { checkRefs([e.lureType], ids('lureTypes'), e.id); checkRefs(e.techniques, ids('techniques'), e.id); checkRefs(e.bonuses, fishIds, e.id); }
  for (const list of [e.strength, e.length, e.engine, e.storage].filter(Boolean)) assert(list.every((u, i) => u.level === i && u.cost >= 0));
}
for (const u of catalog.unlocks) {
  checkRefs(u.fishIds, fishIds, u.id);
  checkRefs(u.locationIds, locationIds, u.id);
  checkRefs(u.requiredItemIds, allIds, u.id);
  if (u.itemId) assert(allIds.has(u.itemId));
}
for (const a of catalog.achievements) if (a.fish) assert(fishIds.has(a.fish.id), `Unknown achievement fish: ${a.fish.id}`);
const articleIds = new Set(articles.map(a => a.id));
assert.equal(articleIds.size, articles.length);
for (const a of articles) {
  assert(a.sections.length && a.sources.length, `Incomplete article: ${a.id}`);
  checkRefs(a.relatedFishIds, fishIds, a.id);
  checkRefs(a.relatedEquipmentIds, equipmentIds, a.id);
  for (const s of a.sources) assert(new URL(s.url).protocol === 'https:');
}
const app = readFileSync('src/main.tsx', 'utf8');
for (const [, id] of app.matchAll(/#\/handbook\/([a-z0-9-]+)/g)) assert(articleIds.has(id), `Broken handbook link: ${id}`);
const scenes = JSON.parse(readFileSync('scripts/scenes.json', 'utf8'));
for (const name of Object.keys(scenes)) assert(existsSync(`public/game-assets/scenes/${name}.webp`), `Missing scene: ${name}`);
console.log(`Catalog valid: ${catalog.fish.length} fish, ${catalog.locations.length} locations, ${catalog.equipment.length} tackle/transport, ${catalog.achievements.length} achievements, ${catalog.cosmetics.length} appearance options, ${articles.length} articles, ${assets} sprites.`);
