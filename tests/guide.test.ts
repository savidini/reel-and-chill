import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { filterAchievements, filterFish, matchingConditions, searchGuide, suggestedTackle, timeLabel, weight } from '../src/guide.ts';
import { achievementNotes } from '../src/content/achievements.ts';
import type { Article, Catalog, Fish } from '../src/types.ts';

const catalog: Catalog = JSON.parse(readFileSync('public/data/catalog.json', 'utf8'));
const articles: Article[] = JSON.parse(readFileSync('src/content/articles.json', 'utf8'));
const fish = (id: string) => catalog.fish.find(f => f.id === id)!;

test('installed 1.3.0 inventory has complete species/variant coverage', () => {
  assert.equal(catalog.fish.length, 68);
  assert.equal(catalog.species.length, 59);
  assert.equal(catalog.fish.filter(f => f.variant === 'ice').length, 10);
  assert.equal(catalog.locations.length, 17);
  assert.equal(catalog.equipment.filter(e => e.kind === 'rod').length, 10);
  assert.equal(catalog.equipment.filter(e => e.kind === 'lure').length, 23);
  assert.equal(catalog.achievements.length, 38);
  assert.equal(filterFish(catalog.fish, {}).length, 68);
});

test('each legendary encounter has the individually audited location and time', () => {
  const expected: Record<string, [string, string]> = {
    walleye: ['river1-spot1', 'dawn,day,dusk,night'], 'common-carp': ['lake1-spot3', 'dawn'],
    'northern-pike': ['lake1-spot2', 'night'], muskie: ['river2-spot1', 'night'], burbot: ['river1-spot3', 'dusk'],
    'largemouth-bass': ['river1-spot2', 'dusk'], 'lake-trout': ['lake1-spot1', 'dawn'], 'cutthroat-trout': ['river2-spot2', 'day'],
    'atlantic-salmon': ['ocean1-spot1', 'night'], 'chinook-salmon': ['ocean1-spot3', 'dusk'], lingcod: ['ocean1-spot2', 'dawn'],
    'pacific-halibut': ['ocean2-spot1', 'dusk'], 'striped-bass': ['ocean2-spot2', 'dawn'], 'channel-catfish': ['lake2-spot1', 'night'],
    'white-sturgeon': ['lake2-spot2', 'dusk'], 'ice-tiger-muskie': ['ice1-spot1', 'night'],
  };
  const legends = filterFish(catalog.fish, { encounter: 'legendary' });
  assert.equal(legends.length, 16);
  for (const f of legends) {
    const c = matchingConditions(f, { encounter: 'legendary' });
    assert.equal(c.length, 1, f.id);
    assert.deepEqual([c[0].locationId, c[0].times.join(',')], expected[f.id], f.id);
  }
});

test('location, time, size and encounter must match the same spawn', () => {
  assert.equal(filterFish(catalog.fish, { q: 'Northern Pike', variant: 'open-water', time: 'day', encounter: 'legendary' }).length, 0);
  assert.deepEqual(filterFish(catalog.fish, { q: 'Northern Pike', variant: 'open-water', time: 'night', encounter: 'legendary' }).map(f => f.id), ['northern-pike']);
  assert.equal(filterFish(catalog.fish, { q: 'King Salmon', water: 'ocean1-spot2', time: 'dusk', encounter: 'legendary' }).length, 0);
  assert.equal(filterFish(catalog.fish, { q: 'King Salmon', water: 'ocean1-spot3', time: 'dusk', encounter: 'legendary' }).length, 1);
  assert.equal(filterFish(catalog.fish, { q: 'Northern Pike', variant: 'open-water', encounter: 'legendary', size: 's' }).length, 0);
});

test('unknown time is never confused with unrestricted spawning', () => {
  const unknown: Fish = { ...fish('walleye'), conditions: [{ ...fish('walleye').conditions[0], timeStatus: 'unknown', times: [] }] };
  assert.equal(timeLabel(unknown.conditions[0]), 'Time unconfirmed');
  assert.equal(filterFish([unknown], { time: 'day' }).length, 0);
  assert.equal(filterFish([unknown], { time: 'unknown' }).length, 1);
  assert.equal(filterFish([unknown], {}).length, 1);
  assert.equal(timeLabel(fish('walleye').conditions.find(c => c.encounter === 'legendary')!), 'Any time');
});

test('ice forms, ordinary spawns, trophies and legends retain distinct meaning', () => {
  assert.notEqual(fish('walleye').trophyWeight, fish('ice-walleye').trophyWeight);
  assert.equal(fish('ice-walleye').legendary, false);
  assert.equal(fish('ice-tiger-muskie').legendary, true);
  assert.equal(filterFish([fish('walleye')], { encounter: 'ordinary' }).length, 1);
  assert.equal(filterFish([fish('bluegill-sunfish')], { encounter: 'trophy' }).length, 1);
  assert.equal(filterFish([fish('bluegill-sunfish')], { encounter: 'legendary' }).length, 0);
});

test('every obtainable fish size has a preferred compatible rod/lure combination', () => {
  for (const f of catalog.fish) for (const size of f.sizes) {
    const { rods, lures } = suggestedTackle(catalog, f, size);
    assert(rods.length && lures.length, `${f.id}/${size}: missing loadout`);
    assert(rods.every(r => r.environment === f.variant && r.sizes.includes(size)));
    assert(lures.every(l => l.sizes.includes(size) && f.preferredLures.includes(l.lureType!)));
  }
  assert(suggestedTackle(catalog, fish('ice-tiger-muskie'), 'xxl').rods.every(r => r.id === 'rod10'));
  assert(fish('pacific-halibut').conditions.every(c => !c.sizes.includes('xxxl')), 'Unused XXXL core label must not leak into actual fish sizes');
});

test('search finds current names, internal aliases, legendary titles and handbook text', () => {
  assert(filterFish(catalog.fish, { q: 'chinook salmon' }).some(f => f.id === 'chinook-salmon'));
  assert(filterFish(catalog.fish, { q: 'salt king' }).some(f => f.id === 'chinook-salmon'));
  assert(filterFish(catalog.fish, { q: 'walleye pike' }).some(f => f.id === 'walleye'));
  assert(searchGuide(catalog, articles, 'stocking').some(r => r.href === '#/handbook/pond-stocking'));
  assert(searchGuide(catalog, articles, 'phantom').some(r => r.href === '#/tackle/rod04'));
  assert.equal(searchGuide(catalog, articles, '   ').length, 0);
  assert.equal(filterFish(catalog.fish, { q: 'a fish that does not exist' }).length, 0);
});

test('weight formatting rounds ounces across pound boundaries and supports kilograms', () => {
  assert.equal(weight(20.1), '20 lb 2 oz');
  assert.equal(weight(1.99), '2 lb');
  assert.equal(weight(0.5), '8 oz');
  assert.equal(weight(10, 'kg'), '4.5 kg');
});

test('every achievement has unlock guidance with valid related records', () => {
  for (const [id, note] of Object.entries(achievementNotes)) {
    assert(catalog.achievements.some(a => a.id === id), `Unknown achievement note: ${id}`);
    assert(articles.some(a => a.id === note.articleId), `${id}: unknown handbook link`);
    for (const fishId of note.fishIds || []) assert(catalog.fish.some(f => f.id === fishId), `${id}: unknown fish ${fishId}`);
    for (const locationId of note.locationIds || []) assert(catalog.locations.some(l => l.id === locationId), `${id}: unknown place ${locationId}`);
  }
  for (const a of catalog.achievements) {
    if (a.kind === 'CatchTrophy') {
      const target = catalog.fish.find(f => f.id === a.fish?.id);
      assert(target?.conditions.some(c => c.encounter === 'legendary'), `${a.id}: missing legendary catch window`);
      assert(target.trophyWeight > 0, `${a.id}: missing trophy threshold`);
    } else assert(achievementNotes[a.id]?.tip, `${a.id}: missing unlock tip`);
  }
  const tigerMuskie = catalog.achievements.find(a => a.id === 'tiger-muskie-trophy')!;
  assert.equal(tigerMuskie.fish?.id, 'ice-tiger-muskie');
});

test('achievement searches combine tips, fish aliases and places with category filters', () => {
  assert.equal(filterAchievements(catalog).length, 38);
  assert.equal(filterAchievements(catalog, '', 'legendary').length, 16);
  assert.equal(filterAchievements(catalog, '', 'cabin').length, 5);
  assert.equal(filterAchievements(catalog, '', 'general').length, 17);
  assert.deepEqual(filterAchievements(catalog, 'always above').map(a => a.id), ['catch-above-l', 'catch-above-xl', 'catch-above-xxl']);
  assert.deepEqual(filterAchievements(catalog, 'chinook', 'legendary').map(a => a.id), ['chinook-salmon-trophy']);
  assert(filterAchievements(catalog, 'Otter Cove').some(a => a.id === 'catch-with-fish'));
  assert(filterAchievements(catalog, 'Frostbite Flats').some(a => a.id === 'tiger-muskie-trophy'));
  assert.deepEqual(filterAchievements(catalog, '750', 'cabin').map(a => a.id), ['clean-pond']);
  assert.equal(filterAchievements(catalog, 'White Tip', 'cabin').length, 0);
  assert.equal(filterAchievements(catalog, 'no-such-achievement').length, 0);
  assert(searchGuide(catalog, articles, 'Always Above').some(r => r.href === '#/achievements?q=Above%20Board'));
});
