#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["UnityPy==1.25.4"]
# ///
"""Read an installed Steam copy; generate a local, offline reference catalog.

Never writes to the installation or reads save files. Only objects referenced by
the production build's included bundle tables become catalog entries.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import warnings

import UnityPy
from UnityPy.classes import PPtr
from UnityPy.helpers import TypeTreeHelper

PROJECT = Path(__file__).resolve().parent.parent
DEFAULT_GAME = Path.home() / '.local/share/Steam/steamapps/common/Cast n Chill'
TIMES = [(1, 'dawn'), (2, 'day'), (4, 'dusk'), (8, 'night')]


def clean(text):
    return re.sub(r'<[^>]+>', '', text or '').strip()


def curve_value(curve, percent):
    """Two linear segments around the serialized average/pivot; approximate UI values."""
    t = percent / 100
    p = curve['pivot']
    if t <= p:
        return curve['min'] + (curve['avg'] - curve['min']) * t / p
    return curve['avg'] + (curve['max'] - curve['avg']) * (t - p) / (1 - p)


class Importer:
    def __init__(self, game_dir, output):
        self.game_dir = game_dir.resolve()
        self.output = output.resolve()
        if self.output.is_relative_to(self.game_dir):
            raise ValueError('Output must be outside the read-only game installation.')
        self.assets_dir = self.output / 'game-assets'
        self.data_dir = self.output / 'data'
        self.assets_dir.mkdir(parents=True, exist_ok=True)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        root = self.game_dir / 'castnchill_Data'
        if not root.is_dir():
            raise ValueError(f'No castnchill_Data in {self.game_dir}. Pass --game-dir.')
        version = re.search(rb'\d{4}\.\d+\.\d+[abfp]\d+', (root / 'globalgamemanagers').read_bytes())
        if not version:
            raise ValueError('Cannot determine Unity version; refusing to guess the decoder version.')
        UnityPy.config.FALLBACK_UNITY_VERSION = version[0].decode()
        # Pure Python reader avoids a native typetree crash on Python 3.14.
        TypeTreeHelper.read_typetree_boost = None
        warnings.filterwarnings('ignore', message='No valid Unity version found.*')
        bundles = root / 'StreamingAssets/aa/StandaloneWindows64'
        paths = [bundles / 'core_assets_all.bundle', bundles / 'build#prod_assets_all.bundle']
        for pattern in ['*monoscripts*', 'locations*', 'localization-string-tables-english*', 'localization-assets-shared*']:
            paths.extend(sorted(bundles.glob(pattern)))
        print('Reading production bundles (read-only)…', flush=True)
        self.env = UnityPy.load(*map(str, paths))
        self.trees = {}
        self.classes = defaultdict(list)
        self.object_classes = {}
        for obj in self.env.objects:
            if obj.type.name != 'MonoBehaviour':
                continue
            script = obj.read().m_Script
            cls = script.read().m_ClassName if script.m_PathID else ''
            self.classes[cls].append(obj)
            self.object_classes[self.key(obj)] = cls
        self.strings = {}
        for obj in self.classes['StringTable']:
            data = self.tree(obj)
            shared = self.tree(self.ref(obj, data['m_SharedData']))
            keys = {row['m_Id']: row['m_Key'] for row in shared['m_Entries']}
            values = {}
            for row in data['m_TableData']:
                values[str(row['m_Id'])] = clean(row['m_Localized'])
                values[keys[row['m_Id']]] = clean(row['m_Localized'])
            for name in [shared['m_TableCollectionName'], 'GUID:' + shared['m_TableCollectionNameGuidString']]:
                self.strings[name] = values
        build = next(o for o in self.classes['BuildData'] if self.tree(o)['id'] == 'prod')
        self.active = defaultdict(dict)
        self.bundle_info = []
        for ptr in self.tree(build)['includedBundles']:
            obj = self.ref(build, ptr)
            data = self.tree(obj)
            self.bundle_info.append({'id': data['id'], 'steamAppId': data['steamAppId']})
            for table in data['tables']:
                for item in table['list']:
                    entry = self.ref(obj, item)
                    self.active[table['title']][self.tree(entry)['id']] = entry
        self.sprite_count = 0
        self.missing_names = []

    @staticmethod
    def key(obj):
        return obj.assets_file.name, obj.path_id

    def tree(self, obj):
        if obj is None:
            return {}
        key = self.key(obj)
        if key not in self.trees:
            self.trees[key] = obj.read_typetree()
        return self.trees[key]

    @staticmethod
    def ref(obj, ptr):
        if not ptr or not ptr.get('m_PathID'):
            return None
        return PPtr(m_FileID=ptr['m_FileID'], m_PathID=ptr['m_PathID'], assetsfile=obj.assets_file).deref()

    def ref_id(self, obj, ptr):
        return self.tree(self.ref(obj, ptr)).get('id')

    def refs(self, obj, field):
        return [self.ref_id(obj, p) for p in self.tree(obj).get(field, [])]

    def loc(self, field, fallback=''):
        table = field.get('m_TableReference', {}).get('m_TableCollectionName', '')
        entry = field.get('m_TableEntryReference', {})
        key = str(entry.get('m_KeyId')) if entry.get('m_KeyId') else entry.get('m_Key', '')
        result = self.strings.get(table, {}).get(key, '')
        def substitute(match):
            table_name, entry_id = match.group(1), match.group(2)
            return self.strings.get(table_name.title(), {}).get(entry_id, entry_id.replace('-', ' ').title())
        result = re.sub(r'\{(fish|location|area|items)/([^}]+)\}', substitute, result)
        return result or fallback

    def sprite(self, obj, fields, folder, ident, data=None):
        data = self.tree(obj) if data is None else data
        sprite = next((self.ref(obj, data.get(f)) for f in fields if data.get(f, {}).get('m_PathID')), None)
        if sprite is None:
            return None
        dest = self.assets_dir / folder / f'{ident}.png'
        dest.parent.mkdir(parents=True, exist_ok=True)
        bitmap = sprite.read().image.convert('RGBA')
        # GUI customization sprites store the palette index in their blue channel.
        # Match the item's serialized remap colors, preserving the alpha silhouette.
        if data.get('indexColours'):
            graphics = self.tree(self.classes['GraphicsConfig'][0])
            colors = graphics.get('commonIndexColours', []) + data['indexColours']
            palette = {c['index']: tuple(round(c['color'][k] * 255) for k in 'rgb') for c in colors}
            bitmap.putdata([(*palette.get(b, (r, g, b)), a) for r, g, b, a in bitmap.get_flattened_data()])
        bitmap.save(dest, optimize=True)
        self.sprite_count += 1
        return '/' + str(dest.relative_to(self.output))

    def items(self, category):
        return sorted(self.active[category].values(), key=lambda o: (self.tree(o).get('order', 0), self.tree(o)['id']))

    def base(self, obj, folder, fields=('sprite', 'icon', 'onSprite')):
        d = self.tree(obj)
        fallback = d.get('layerName') or d.get('altName') or d['id'].replace('-', ' ').title()
        if d['id'] == 'none':
            fallback = 'No companion'
        return {'id': d['id'], 'name': self.loc(d.get('displayName', {}), fallback),
                'order': d.get('order', 0), 'description': self.loc(d.get('description', {})),
                'image': self.sprite(obj, fields, folder, d['id']), 'bundles': d.get('bundles', {}).get('list', []),
                'unlockIds': self.refs(obj, 'keys')}

    def upgrades(self, obj, key, fields):
        result = []
        for level, p in enumerate(self.tree(obj).get(key, {}).get('levels', [])):
            d = self.tree(self.ref(obj, p))
            result.append({'level': level, 'cost': d['cost'], **{f: d[f] for f in fields}})
        return result

    def run(self):
        graphics = self.classes['GraphicsConfig'][0]
        time_config = self.tree(graphics)['gui']['timeOfDay']
        # Follow the game's named UI references so dawn and dusk cannot be
        # confused by their similar silhouettes or sprite-sheet positions.
        time_icons = {period: self.sprite(graphics, (f'{period}Sprite',), 'ui', f'time-{period}', data=time_config)
                      for _, period in TIMES}
        if not all(time_icons.values()):
            raise ValueError('Missing a game time-of-day icon.')
        sizes = [{'id': self.tree(o)['id'], 'minWeight': self.tree(o)['minWeight'],
                  'minLineWeight': self.tree(o)['minLineWeight']} for o in self.items('FishSize')]

        def range_sizes(lo, hi, allowed):
            # Fish definitions cap the journal size. XXL halibut remain XXL above
            # 200 lb; the core XXXL definition is not used by any current fish.
            bins = [s for s in sizes if s['id'] in allowed]
            return [s['id'] for i, s in enumerate(bins) if hi >= s['minWeight'] and
                    (i == len(bins)-1 or lo < bins[i+1]['minWeight'])]

        fish = []
        for o in self.items('Fish'):
            d = self.tree(o)
            fish.append({**self.base(o, 'fish'), 'speciesId': d['id'].removeprefix('ice-'),
                         'variant': 'ice' if d['id'].startswith('ice-') else 'open-water',
                         'aliases': d.get('altIds', []) + ([d['altName']] if d.get('altName') else []),
                         'rarity': self.ref_id(o, d['rarity']), 'sizes': self.refs(o, 'sizes'),
                         'preferredLures': self.refs(o, 'preferredLureTypes'), 'ignoredLures': self.refs(o, 'ignoreLureTypes'),
                         'preferredLine': self.ref_id(o, d['preferredLineType']),
                         'locationIds': d['locations'], 'habitats': d['habitats'],
                         'length': d['length'], 'weight': d['weight'], 'value': d['value'],
                         'trophyPercent': d['trophySize'], 'trophyWeight': round(curve_value(d['weight'], d['trophySize']), 5),
                         'legendary': bool(d['legendary']), 'stamina': d['stamina'], 'speed': d['speed'],
                         'vision': d['vision'], 'hearing': d['hearing'], 'fightStyle': self.ref_id(o, d['fightAction']),
                         'conditions': [], 'source': f'https://castnchill.unpack.wiki/docs/fish/{d["id"]}/'})
        fish_map = {f['id']: f for f in fish}
        configs = {self.tree(o)['m_Name'].lower(): self.tree(o) for o in self.classes['LocationConfig']}
        locations = []
        for o in self.items('Location'):
            d = self.tree(o)
            if d['comingSoon']:
                continue
            config = configs.get(d['assetName'].lower())
            if config is None:
                raise ValueError(f'Missing location config: {d["id"]}')
            kind = 'ice' if d['type'] == 4 else 'pond' if d['type'] == 2 else re.match(r'[a-z]+', d['id'])[0]
            locations.append({**self.base(o, 'locations'), 'areaId': self.ref_id(o, d['area']), 'kind': kind,
                              'fishIds': d['fish'], 'hint': self.loc(d['hint']), 'mapPosition': d['mapPos'],
                              'restock': d['restock'], 'source': f'https://castnchill.unpack.wiki/docs/locations/{d["id"]}/'})
            seen = set()
            for spawn in config['spawns']:
                f = fish_map[spawn['fish']]
                lo, hi = spawn['sizeRange']['min'], spawn['sizeRange']['max']
                mask = spawn.get('timesOfDay')
                # 0/absent is unknown, never silently widened to all periods.
                time_status = 'unrestricted' if mask in (15, -1) else 'restricted' if mask and mask & 15 else 'unknown'
                encounter = 'legendary' if f['legendary'] and lo >= f['trophyPercent'] else 'ordinary'
                key = (f['id'], lo, hi, mask)
                if key in seen:
                    continue
                seen.add(key)
                min_weight, max_weight = curve_value(f['weight'], lo), curve_value(f['weight'], hi)
                f['conditions'].append({'locationId': d['id'], 'timeStatus': time_status,
                                        'times': [name for bit, name in TIMES if mask is not None and mask & bit],
                                        'percentRange': [lo, hi], 'weightRange': [round(min_weight, 5), round(max_weight, 5)],
                                        'sizes': range_sizes(min_weight, max_weight, f['sizes']), 'encounter': encounter,
                                        'trophyPossible': hi >= f['trophyPercent'], 'bounds': spawn['worldBounds']})
        areas = []
        used_areas = {l['areaId'] for l in locations}
        for o in self.items('Area'):
            d = self.tree(o)
            if d['id'] in used_areas:
                areas.append({**self.base(o, 'areas'), 'cost': d['cost'], 'requiresDeed': bool(d['requiresDeed'])})
        equipment = []
        for category, kind in [('Rod', 'rod'), ('Lure', 'lure'), ('Boat', 'boat')]:
            for o in self.items(category):
                d = self.tree(o)
                e = {**self.base(o, 'equipment'), 'kind': kind, 'cost': d['cost'], 'sizes': self.refs(o, 'sizes'),
                     'environment': 'ice' if d.get('locationType') == 4 else 'open-water' if kind != 'lure' else 'both',
                     'source': f'https://castnchill.unpack.wiki/docs/{category.lower()}s/{d["id"]}/'}
                if kind == 'rod':
                    e.update(lineType=self.ref_id(o, d['lineType']), reelType=self.ref_id(o, d['reelType']),
                             strength=self.upgrades(o, 'strength', ['weight']), length=self.upgrades(o, 'length', ['spoolDistance', 'breakDistance']))
                elif kind == 'lure':
                    e.update(lureType=self.ref_id(o, d['lureType']), techniques=self.refs(o, 'techniques'),
                             bonuses=d['bonuses'], startAvailable=bool(d['startAvailable']))
                else:
                    e.update(engine=self.upgrades(o, 'engine', ['maxSpeed']), storage=self.upgrades(o, 'storage', ['capacity']))
                equipment.append(e)
        unlocks = []
        for o in self.items('Key'):
            d = self.tree(o)
            unlocks.append({'id': d['id'], 'kind': self.object_classes[self.key(o)].removesuffix('KeyData'),
                            'itemId': self.ref_id(o, d['item']), 'autoUnlock': bool(d['autoUnlock']),
                            'locationIds': d.get('locations', []), 'requiredItemIds': self.refs(o, 'requiredItems'),
                            'fishIds': d.get('fish', [])})
        achievements = []
        for o in self.items('Achievement'):
            d = self.tree(o)
            a = {**self.base(o, 'achievements', ('onSprite',)), 'kind': self.object_classes[self.key(o)].removesuffix('AchievementData')}
            for k in ['fish', 'count', 'flags', 'flag', 'seconds', 'duration']:
                if k in d:
                    if k == 'fish' and not d[k].get('id'):
                        continue
                    a[k] = d[k]
            achievements.append(a)
        cosmetics = []
        for category, kind in [('Companion', 'companion'), ('AnglerSkin', 'angler'), ('AnglerHat', 'hat'), ('AnglerOutfit', 'outfit'), ('BoatVariant', 'boat-color')]:
            for o in self.items(category):
                d = self.tree(o)
                item = {**self.base(o, 'wardrobe'), 'kind': kind, 'variantName': d.get('layerName', ''),
                                  'colors': ['#' + ''.join(f'{round(c["color"][v] * 255):02x}' for v in 'rgb') for c in d.get('indexColours', [])],
                                  'supporter': 'supporter' in d.get('bundles', {}).get('list', [])}
                if kind in ['angler', 'hat', 'outfit']:
                    item['name'] += f' · {d["id"]}'
                if kind == 'boat-color':
                    item['boatId'] = self.ref_id(o, d['boat'])
                    boat = next(e for e in equipment if e['id'] == item['boatId'])
                    item['name'] = boat['name'] + ' · ' + d['id'].split('.')[-1].upper()
                    item['colors'] = ['#' + ''.join(f'{round(d["color"][v] * 255):02x}' for v in 'rgb')]
                cosmetics.append(item)
        dictionaries = {}
        for category, dest in [('LureType', 'lureTypes'), ('LineType', 'lineTypes'), ('ReelType', 'reelTypes'), ('Technique', 'techniques'), ('Rarity', 'rarities')]:
            dictionaries[dest] = []
            objects = {self.tree(o)['id']: o for o in self.items(category)}
            if category == 'Technique':
                # Lures can reference a specialized technique outside the common
                # bundle table, such as Topwater's long steady retrieve.
                for lure in self.items('Lure'):
                    for ptr in self.tree(lure)['techniques']:
                        technique = self.ref(lure, ptr)
                        objects[self.tree(technique)['id']] = technique
            for o in objects.values():
                d = self.tree(o)
                row = {'id': d['id'], 'name': self.loc(d.get('displayName', {}), d['id'].replace('-', ' ').title())}
                if category == 'LineType':
                    row['scaresSmallerFish'] = bool(d['scaresSmallerFish'])
                dictionaries[dest].append(row)
        version = (self.game_dir / 'version.txt').read_text().strip()
        manifest = self.game_dir.parent.parent / 'appmanifest_3483740.acf'
        match = re.search(r'"buildid"\s+"(\d+)"', manifest.read_text()) if manifest.exists() else None
        for f in fish:
            trophy = next((a for a in achievements if a.get('fish', {}).get('id') == f['id'] and a['kind'] == 'CatchTrophy'), None)
            f['legendName'] = trophy['name'].removeprefix('Legendary ') if trophy and f['legendary'] else None
        species = [{'id': ident, 'name': variants[0]['name'], 'variantIds': [f['id'] for f in variants]}
                   for ident in dict.fromkeys(f['speciesId'] for f in fish)
                   if (variants := [f for f in fish if f['speciesId'] == ident])]
        catalog = {'schemaVersion': 1, 'meta': {'gameVersion': version, 'steamBuild': match[1] if match else None,
                   'importedAt': datetime.now(timezone.utc).isoformat(), 'unityVersion': UnityPy.config.FALLBACK_UNITY_VERSION,
                   'bundles': self.bundle_info, 'coverage': {k: len(v) for k, v in self.active.items()},
                   'speciesCount': len({f['speciesId'] for f in fish}),
                   'notes': [
                       'Catalog membership comes from the installed production build, including separately labelled Supporter Pack companions.',
                       'Trophy and spawn weights are approximate values calculated from the serialized min/average/max curve. The in-game rounded display is authoritative.',
                       'Legendary Walleye: this build permits all four periods; some community guides say Day only. Local configuration is shown.',
                       'No exact clock-hour boundaries are inferred from the game’s named time periods.',
                       'The cabin pond has no native spawns; stock eligible freshwater fish yourself.'],
                   'sources': [{'title': 'Installed Cast n Chill production bundles', 'url': 'https://store.steampowered.com/app/3483740/Cast_n_Chill/'},
                               {'title': 'Community fish inventory (cross-check)', 'url': 'https://castnchill.unpack.wiki/docs/fish/'},
                               {'title': 'Community location inventory (cross-check)', 'url': 'https://castnchill.unpack.wiki/docs/locations/'},
                               {'title': 'Wombat Brawler official press kit', 'url': 'https://www.wombatbrawler.com/cnc-press-kit'}]},
                   'timeIcons': time_icons, 'fish': fish, 'species': species, 'locations': locations, 'areas': areas, 'sizes': sizes, 'equipment': equipment,
                   'unlocks': unlocks, 'achievements': achievements, 'cosmetics': cosmetics, **dictionaries}
        if self.missing_names:
            raise ValueError('Unresolved English strings: ' + ', '.join(sorted(set(self.missing_names))))
        for f in fish:
            if not f['conditions'] or not f['image']:
                raise ValueError(f'Missing fish conditions/artwork: {f["id"]}')
        dest = self.data_dir / 'catalog.json'
        temp = dest.with_suffix('.tmp')
        temp.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n')
        temp.replace(dest)
        print(f'Imported {len(fish)} fish entries, {len(locations)} locations, {len(equipment)} tackle/boats, '
              f'{len(achievements)} achievements, {len(cosmetics)} wardrobe/companions; {self.sprite_count} sprites.', flush=True)
        print(f'Catalog: {dest}', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--game-dir', type=Path, default=DEFAULT_GAME)
    parser.add_argument('--output', type=Path, default=PROJECT / 'public')
    args = parser.parse_args()
    Importer(args.game_dir, args.output).run()


if __name__ == '__main__':
    main()
