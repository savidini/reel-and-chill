# Reel & Chill

**Your Cast n Chill companion.**

[Open Reel & Chill](https://savidini.de/reel-and-chill/) · [Source on GitHub](https://github.com/savidini/reel-and-chill)

An illustrated handbook for the Steam edition of **Cast n Chill**, with five selectable designs and actual game sprites. The Original design keeps its pixel wordmark, warm paper and dark pine themes, and the [Alpine Dawn](https://ascii.rest/alpine-dawn/) scene from ascii.rest. No accounts. Pocket includes a manual checklist saved only in this browser; it never reads or changes game saves.

The populated catalog targets **v1.3.0 (160)**, Steam build **23698998**:

- 59 species across 68 entries, including 10 ice variants and 16 legendary encounters.
- 17 locations across eight regions, with licences and unlock requirements.
- 10 rods, 23 lures, five boats/transport options, and their upgrade tables.
- 38 achievements, 110 appearance/companion options, and 17 handbook articles.
- A searchable Achievements chapter in all five designs, with category filters, expandable unlock tips, and links to relevant fish, waters, and handbook articles. Legendary entries include their imported catch windows and trophy thresholds; community advice credits [Caff Caff’s Steam guide](https://steamcommunity.com/sharedfiles/filedetails/?id=3501739394).
- Search by fish name, older name, legendary title, place, tackle, or handbook topic.
- Combined location, time, lure, size, rarity, encounter, and fishing-mode filters.
- Cards show matching catch conditions; phone filters collapse and selected filters can be removed individually.
- Fish-specific trophy thresholds and size-compatible tackle suggestions.
- Cabin restoration, stocking, cleanup, fish viewing, progression, and announced content.
- Keyboard search, a modal chapter index on phones, and restored scroll position when returning with browser Back.
- A styled display panel with Light, Dark, and System choices and weight units. Preferences are saved locally; the theme applies before the first paint and System follows live operating-system changes.
- Illustrated chapter entries and direct search from the welcome page, with chapter shortcuts in the search dialog.
- Saved card/list display for the fish atlas and legends, plus section shortcuts in handbook articles.
- Compact fish facts, sticky section shortcuts on fish and tackle details, and shorter equipment cards on phones. Tackle breadcrumbs retain your filters.

Use the grid/list buttons beside **Sort** to change the atlas layout. List view keeps catch conditions and size labels visible in shorter rows, useful beside the game or on a phone. The choice stays selected when opening a fish and returning to the atlas.

Original is the default. Open **Design** at the top right to choose a different interface. These are independent React views with their own navigation, composition, and detail pages. They share the imported catalog and reference utilities.

- **Original:** the complete nine-chapter field guide and animated ASCII lake.
- **Sunday Cast:** a broadsheet fishing magazine, with a current issue, long-form stories, an alphabetical species index, and natural-history specimen pages.
- **Drift:** a landscape-led journey through the waters. Browse destinations with the numbered strip, previous/next controls, or the searchable **All waters** directory. Explore the fish below each scene and open a full-page specimen for catch windows and compatible tackle. A separate species search and quiet reading pages keep the reference close at hand.
- **Sonar:** a reference desk with filters, a sortable species table, and a separate record inspector. Equipment and field notes have dedicated views. Use `/` or `Ctrl/Cmd+K` to search, arrows to browse results, and Enter to open a record.
- **Pocket:** a collectible catch book, a manual caught/to-catch checklist, fish-card spreads, destination postcards, and expandable field notes. The checklist distinguishes ice variants and is independent of your game.

The alternatives deliberately curate the content around their main task. Each provides a link to the complete Original guide. Standard fish, water, article, and achievement links remain usable when changing designs. Achievement searches and categories travel with the link; other view-specific searches and filters belong to each interface.

The design, **Light / Dark / System** appearance, and **lb / oz / kg** choice are saved locally. The design and appearance synchronize between tabs. Preferences apply before the app loads. Open the appearance button (the sun/moon icon on phones) to change theme or weight units. Both popovers support keyboard selection, Escape, and outside dismissal.

## Run from source

Requires Node.js 22.18+ (Node 24 recommended) and npm. The catalog, sprites, landscape artwork, fonts, and licences are committed, so a fresh checkout builds without the game or Python.

```sh
git clone https://github.com/savidini/reel-and-chill.git
cd reel-and-chill
npm ci
npm run data:validate
npm test
npm run dev
```

Development runs at **http://127.0.0.1:5173/**. No browser opens automatically. Stop the server with `Ctrl+C`.

```sh
npm run build
npm run preview
```

Production previews run at **http://127.0.0.1:4173/reel-and-chill/**. Opening `dist/index.html` directly as a file will not load the catalog. Normal browsing requests only the site's bundled resources; source links open external sites.

## GitHub Pages

Pushes to `main` and manual runs of [the deployment workflow](.github/workflows/pages.yml) validate the committed data, run unit tests, build with Node 24, and run headless Playwright smoke checks before publishing `dist/`. Pages uses GitHub Actions as its source and the `github-pages` environment. The public URL is **https://savidini.de/reel-and-chill/**. The original `https://savidini.github.io/reel-and-chill/` address redirects here because the account’s personal Pages site uses `savidini.de`. This project inherits that domain; it has no separate custom-domain configuration.

[Vite's project-site guidance](https://vite.dev/guide/static-deploy.html#github-pages) is implemented in `vite.config.ts`: development uses `/`, while builds and previews use `/reel-and-chill/`. `src/assets.ts` resolves catalog images, time icons, scenes, and licence URLs beneath that base without changing the catalog schema. Vite handles bundled font and favicon paths. Hash routes such as `#/fish/northern-pike` work on reload without server rewrites. The workflow follows [GitHub's custom Pages workflow requirements](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

The design, theme, units, atlas layout, and Pocket checklist remain browser-local. Their existing storage keys are preserved. Browser storage is scoped to the origin: preferences from localhost do not automatically transfer to the public site.

## Refresh game content

Only content refreshes require the installed Steam game and either [uv](https://docs.astral.sh/uv/) or a project Python environment with UnityPy 1.25.4. Import scripts are never part of the normal build or deployment.

```sh
npm run data:import
npm run assets:fetch
npm run data:validate
```

`data:import` uses `.venv/bin/python` when present; otherwise it runs the pinned Python script through uv. To create the environment manually:

```sh
python3 -m venv .venv
.venv/bin/pip install UnityPy==1.25.4
```

The default installation is `~/.local/share/Steam/steamapps/common/Cast n Chill`. For another Steam library:

```sh
npm run data:import -- --game-dir '/path/to/steamapps/common/Cast n Chill'
```

The importer only reads the installed production bundles and Steam version metadata. It never reads saves or writes to the game installation. It writes the catalog to `public/data/catalog.json` and PNG specimens to `public/game-assets/`. The output path is rejected if it points into the game installation.

`assets:fetch` downloads the 12 landscape illustrations listed in `scripts/scenes.json` from the [official press kit](https://www.wombatbrawler.com/cnc-press-kit) and prepares local WebP files. Existing files are reused; pass `--force` to refresh them. Internet is needed to refresh these downloads; builds use the committed copies. Fonts and licences are bundled in `public/fonts/`: Fira Sans, DejaVu Sans Mono, and the original Cast Pixel display alphabet. Regenerate Cast Pixel with `python3 scripts/build-pixel-font.py` when fontTools is installed; normal builds use the bundled font.

The Alpine Dawn scene and canvas renderer are bundled in `src/vendor/ascii/`, under the original MIT licence by bas3line. The artwork keeps its full composition and palette, with a separate play/pause control. It respects reduced motion and stops rendering when hidden or offscreen. No CDN or external runtime requests are needed.

## After a game update

```sh
npm run data:import
npm run data:validate
npm test
npm run build
```

Check the Sources & Version chapter for the newly imported version. The general validator reconciles active production bundle entries and references. The focused tests also assert the audited 1.3.0 inventory and legendary schedule; review and deliberately update those expectations if the game changes. The prose in `src/content/articles.json` is maintained separately and needs review when mechanics change. Run `assets:fetch` again only if the scene manifest changes. Review and commit the updated catalog and artwork together before publishing.

The game-specific importer expects the Steam Windows/Proton installation layout. Other platforms and future bundle schema changes may need importer adjustments. An import error leaves the previous catalog intact; keep the game closed during updates so its source bundles remain consistent.

## Verification

```sh
npm run data:validate
npm test
npm run build
npm run test:smoke
npm run test:e2e
```

Browser QA requires Python Playwright and its Chromium browser:

Use the Python environment selected by `python3` on your PATH; activate a virtual environment first if your system Python is managed by the operating system.

```sh
python3 -m pip install -r tests/requirements.txt
python3 -m playwright install chromium
```

The QA script launches **headless Chromium in a fresh, isolated context**, serves `dist/` under `/reel-and-chill/` on a temporary loopback server, returning 404 for root-level assets, and closes both afterwards. It never attaches to an existing Chrome session or opens a visible window. External network requests are blocked. It checks animation controls, matching card conditions, removable filters, keyboard search, menu focus and dismissal, Back/scroll restoration, narrow catch tables, units, all chapter/detail links, imported assets, and catalog-loading recovery. Detail shortcuts are checked for focus, sticky-header clearance, and retained filters. Layouts are checked at 1920, 1440, 1280, 1024, 820, 640, 390, and 320 pixels. Theme checks cover both palettes across 14 layouts, rendered text contrast, font consistency, saved preferences, live system changes, tab synchronization, first-paint colors before bundles load, and unavailable browser storage. They also exercise the open display panel, keyboard selection, focus return, outside dismissal, and short-window scrolling. Screenshots and the JSON report go to ignored `artifacts/`. Run `npm run test:e2e -- --themes-only` for the focused appearance checks.

`npm run test:smoke` is the focused deployment gate: it checks branding in all five designs at desktop and phone widths, both themes, detail reloads, search/Back, saved preferences/checklist, catalog retry, and the contents of every bundled file. To repeat it against the public deployment:

```sh
npm run test:smoke -- --url https://savidini.de/reel-and-chill/
```

Run `npm run test:e2e -- --designs-only` for the independent interfaces. It checks each interface's primary task, desktop/mobile detail views, responsive layouts from 320–1920px, both appearances, text contrast, popover reachability in short windows, and saved design/units/checklist state. The Original suite continues to check the complete reference. `npm run test:e2e -- --design-screenshots` provides a shorter visual pass. Use `--design-tasks` for interaction checks or `--design-controls` for popovers and keyboard design switching. Screenshots and JSON evidence go to ignored `artifacts/redesigns/`.

Use `npm run test:e2e -- --drift-only` to review Drift on its own. This includes all 17 destination headings at phone, tablet, and desktop widths; the water directory's search, visible results, keyboard focus, and short-window layout; and the place → fish → catch-window flow with browser Back/Forward. Add `--design-screenshots` for a quick visual pass or `--design-tasks` for interaction checks. Drift screenshots include the landscape, catch section, specimen, notes, and directory; its report is `artifacts/redesigns/expedition-report.json`.

Run `npm run test:e2e -- --achievements-only` for achievement navigation in all five designs, searches and category filters, keyboard disclosure, related links, weight units, browser Back/reload, and preserved searches when switching designs. It checks expanded guidance in both themes at 320–1920px; screenshots and the report are in ignored `artifacts/achievements/`.

## Data notes

Achievement tips in `src/content/achievements.ts` are maintained separately from the imported catalog and should be reviewed after game updates. The installed game supplies requirements, trophy thresholds, and legendary catch windows. The White Tip timing difference from the community guide is called out in its guidance.

- Membership comes from `BuildData.prod → includedBundles → tables`, plus records directly referenced by those entries. This excludes unused configuration objects and collapses the duplicate Safety Cove record.
- Species and ice variants are separate. A condition retains its location, time mask, size range, and ordinary/legendary classification. Combined filters must match a single condition.
- Unknown time is different from unrestricted time. No exact clock-hour boundaries are invented from the named periods.
- Trophy and spawn weights are approximate values interpolated from the serialized minimum, average, maximum, and pivot; the in-game rounded display is authoritative. Trophy thresholds are not size classes.
- Individual fish cap their journal sizes at their configured maximum. An unused core XXXL definition must not reclassify heavy XXL halibut or sturgeon.
- Legendary Walleye is unrestricted in this installed spawn record. Some community references say Day only. The discrepancy is shown in the guide.
- Rod line-length and engine-speed values use the game’s internal scales and are labelled accordingly.
- Appearance sprites apply the game’s serialized palette remaps. Unnamed variants keep readable layer names and reference IDs rather than invented official names.
- The cabin pond has no native spawns; availability depends on stocking. Its configured limit is eight species with eight fish each.

See [the implementation plan](PLAN.md) and [the data audit](docs/DATA_AUDIT.md) for scope and verification notes.

## Attribution and browser agreement

Reel & Chill is an unofficial companion. **Cast n Chill and game artwork belong to Wombat Brawler.** The prepared game catalog, sprites, and official press-kit illustrations are included for the guide; this repository does not relicense those materials. Existing attribution and third-party licences are retained in the Sources & Version chapter, `public/fonts/`, `public/licenses/`, and `src/vendor/ascii/`.

[AGENTS.md](AGENTS.md) records the browser rule: **never use chrome-use unless explicitly requested; all browser tests use headless Playwright**. The installed game remains a read-only source. Importers never read or modify saves. Dependencies, credentials, local tooling state, caches, and build outputs remain ignored by Git.
