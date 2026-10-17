import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { publicAsset, resolveCatalogAssets } from '../src/assets.ts';
import type { Catalog } from '../src/types.ts';

const snapshot: Catalog = JSON.parse(readFileSync('public/data/catalog.json', 'utf8'));
for (const base of ['/', '/reel-and-chill/']) {
  test(`public files resolve beneath ${base}`, () => {
    for (const path of ['data/catalog.json', 'game-assets/scenes/fork.webp', 'fonts/CastPixel.ttf', 'licenses/ascii-rest.txt', 'favicon.svg']) {
      assert.equal(publicAsset(path, base), base + path);
      assert.equal(publicAsset('/' + path, base), base + path);
      assert.equal(publicAsset(base + path, base), base + path);
    }
    for (const path of ['https://example.com/art.png', '//example.com/art.png', 'data:image/png;base64,abc', '#/fish/northern-pike', '']) {
      assert.equal(publicAsset(path, base), path);
    }
  });

  test(`every catalog image and time icon resolves beneath ${base} without changing the schema or snapshot`, () => {
    const before = structuredClone(snapshot);
    const catalog = resolveCatalogAssets(snapshot, base);
    assert.deepEqual(Object.keys(catalog).sort(), Object.keys(snapshot).sort());
    for (const key of ['fish', 'locations', 'areas', 'equipment', 'achievements', 'cosmetics'] as const) {
      catalog[key].forEach((row, i) => {
        const original = snapshot[key][i];
        assert.deepEqual(row, { ...original, image: original.image ? base + original.image.slice(1) : null });
      });
    }
    for (const [time, path] of Object.entries(catalog.timeIcons)) {
      assert.equal(path, base + snapshot.timeIcons[time as keyof Catalog['timeIcons']].slice(1));
    }
    assert.deepEqual(resolveCatalogAssets(catalog, base), catalog);
    assert.deepEqual(snapshot, before);
  });
}
