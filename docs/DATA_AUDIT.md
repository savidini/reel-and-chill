# Data coverage and interpretation

Supported source: installed Steam v1.3.0 (160), build 23698998, Unity 6000.0.64f1. Source bundles are read-only. Saved games and account credentials are not used.

## Inventory reconciliation

The importer follows the production build's six included bundles: core, main, autumn, frozen, cabin, and supporter. It resolves actual table pointers, rather than importing every object whose class resembles a catalog entry.

| Collection | Verified entries | Notes |
| --- | ---: | --- |
| Fish | 68 | 58 open-water entries and 10 ice entries; 59 distinct species |
| Legendary encounters | 16 | One special spawn per legendary entry |
| Locations | 17 | 16 natural fishing spots and the stocked cabin pond |
| Regions | 8 | Only regions referenced by active locations |
| Rods | 10 | Includes two ice rods |
| Lures | 23 | Preferred families, size ranges, bonuses, techniques |
| Boats/transport | 5 | Includes the snowmobile |
| Achievements | 38 | Active production achievements, including cabin and ice |
| Companions | 19 | Includes two Supporter Pack companions and “No companion” |
| Angler appearances | 36 | Distinct palettes retained |
| Hats | 26 | Distinct variants retained |
| Outfits | 17 | Distinct variants retained |
| Boat colours | 12 | Linked to their boat |
| Handbook articles | 17 | Original prose with sources and related entries |

The local ID sets were compared with the live [community fish inventory](https://castnchill.unpack.wiki/docs/fish/) and [location inventory](https://castnchill.unpack.wiki/docs/locations/) on 11 October 2026. Both sets matched exactly: 68 fish entries and 17 location IDs, with no missing or extra IDs. The wiki calls all 68 entries species; this app explicitly groups the nine duplicated open-water/ice species.

The active table lookup avoids the duplicate Safety Cove object and extra unused AreaData records. Some referenced data is outside a root table: Topwater's Long Steady Retrieve is resolved from the lure itself. Empty generic achievement fish references are omitted.

## Legendary audit

These named periods are extracted from the installed location spawn records. The time mask and size interval are preserved together.

| Fish | Location | Legendary period |
| --- | --- | --- |
| Walleye / White Tip | The Fork | Any time* |
| Common Carp / Mud King | Fisherman's Rest | Dawn |
| Northern Pike / Toothy Terror | Underwater Meadow | Night |
| Muskie / Water Wolf | The Rapids | Night |
| Burbot / Slime Belly | The Mistwood | Dusk |
| Largemouth Bass / Bucket Mouth | Beaver Dam | Dusk |
| Lake Trout / Quiet Giant | Picnic Point | Dawn |
| Cutthroat Trout / Ember Jaw | Eagles Nest | Day |
| Atlantic Salmon / Tide Runner | Watchers Point | Night |
| King Salmon / Salt King | Safety Cove | Dusk |
| Lingcod / Reef Growler | Craggy Reef | Dawn |
| Pacific Halibut / Dock Breaker | Divers Drop | Dusk |
| Striped Bass / Bay Wanderer | Seals Rest | Dawn |
| Channel Catfish / Whiskered Warrior | Shallows Edge | Night |
| White Sturgeon / Land Locked Lunker | Otter Cove | Dusk |
| Tiger Muskie (Ice) / Ice Monster | Frostbite Flats | Night |

*Walleye's local mask is 15 (all four periods), while some community guides list Day. The discrepancy is visible in the entry and the edition notes. The catalog describes configured spawn windows, not a guarantee that a fish is present or its runtime quest/respawn state.

## Boundaries and unresolved details

- A spawn mask of 15 or -1 is unrestricted; a missing or zero mask is treated as unknown. Time-of-day transitions are represented by their names; exact clock-hour intervals are not inferred.
- Ordinary spawns of a legendary species are retained separately. The legendary spawn starts at or above the fish's trophy percentile. Ordinary, trophy-possible, and legendary filters have separate meanings.
- Serialized weight curves are interpreted as two linear segments at the recorded pivot. Displayed trophy and spawn weights are approximate, rounded to ounces or kilograms. The configured trophy percentile is also shown so the underlying threshold remains available.
- No actual species uses the core XXXL size definition. Fish-specific size ceilings keep halibut and sturgeon over 200 lb in their configured XXL category.
- The installed location-type mask means open water/cabin versus ice. It is not an ocean/freshwater enum. Equipment suitability uses those actual masks.
- VisitLocation unlock arrays mean any listed location: Horizon Caster needs an ocean visit, and Lake Hunkerdown accepts Craggy Reef or Seals Rest. The local ice-location hint explicitly says “or”; the [Horizon Caster reference](https://castnchill.unpack.wiki/docs/rods/rod05/) confirms a singular ocean visit.
- Raw index colours in appearance icons are remapped from the sprite's blue-channel palette index to the configured RGB colour, preserving transparency.
- Time icons come directly from `GraphicsConfig.gui.timeOfDay`: `dawnSprite`, `daySprite`, `duskSprite`, and `nightSprite`. These are the game's original 9×7 `TimeDawn`, `TimeDay`, `TimeDusk`, and `TimeNight` sprites, displayed at 2× scale. Dawn has a taller sun separated from the horizon; dusk has a lower sun touching it. The corresponding `GraphicsConfig.variants` records confirm the period names and masks.
- Missing optional localization keys for cosmetic labels and item descriptions are expected in the source. Readable game layer names identify unnamed appearances; unresolved `{fish/id}` and `{location/id}` references in hints are resolved to English names.
- The cabin configuration confirms eight stocking groups and eight fish per group. It has no native spawn list. The handbook explains eligible stocked fish and cleanup separately.
- Source code and configuration extraction do not establish every runtime mechanic. Where exact clock units, quest gates, or engine/spool measurement units are unverified, the guide retains a visible limitation instead of inventing a precise value.

## Reproducible checks

`npm run data:validate` checks unique IDs, production table counts, cross-references, spawn membership, valid local artwork, and handbook links. `npm test` exercises combined filters, all 16 legendary schedules, unknown time, variant separation, every fish/size tackle combination, aliases, and unit formatting. `npm run test:e2e` verifies the production build in isolated headless Playwright with external network access blocked.

## Completed verification — 11 October 2026

- Catalog validation passed, including 264 valid extracted PNG assets and all handbook cross-references.
- Eight focused domain tests passed.
- TypeScript and the Vite production build passed.
- Headless Playwright checked 170 routes, including all 150 chapter/detail pages and their additional cross-links.
- All 276 referenced local game/landscape assets returned successfully, including the four original time icons.
- Filters, browser Back, legendary-directory return links, keyboard search and focus return, weight-unit persistence, and missing-catalog guidance passed.
- Desktop, split-screen, phone, and narrow-phone layouts passed at eight widths from 320 to 1920 pixels without page-level overflow. Catch tables become labelled records on phones.
- Zero runtime errors and zero external requests while external network access was blocked.

The generated report is `artifacts/browser-report.json`; representative screenshots are in the same ignored directory. Test browsers and the temporary loopback server are closed at the end of the run.
