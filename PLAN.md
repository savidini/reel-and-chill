# Reel & Chill — implementation history

Your Cast n Chill companion. The original implementation notes below are retained; current setup and public hosting are documented in [README.md](README.md).

## Summary

Build a comprehensive webapp for Cast n Chill: a searchable pixel-art field guide that stays useful beside the game.

Target the installed **v1.3.0 (160)** release, including ice fishing and Old Moose Cabin. Use English, show all spoilers, and focus entirely on reference material without personal catch tracking.

## Design and navigation

- Use warm paper or dark pine surfaces, charcoal navigation, copper accents, and original pixel icons and wordmark. Use Fira Sans consistently for headings, controls, and reading text, with compact mono labels for sizes and chapter numbers.
- Offer Light, Dark, and System appearance, persist the choice locally, and apply it before first paint. Use semantic color tokens throughout chapters, controls, and dialogs.
- Use a themed display panel for appearance and weight units, with visible selected states, native radio keyboard behavior, and dismissal by Escape or outside click. Review the open control in both palettes and narrow windows.
- Keep actual game fish and equipment sprites, with landscape artwork on chapter openings.
- Open with the actual [Alpine Dawn scene from ascii.rest](https://ascii.rest/alpine-dawn/), bundled locally under its MIT licence. Keep its native proportions and rose-and-blue palette in an unobstructed frame; place the title, Atlas button, and animation control outside the artwork. Pair it with direct guide search and follow with illustrated chapter entries.
- Pause animation when offscreen or in a hidden tab; respect reduced motion and provide a play/pause control. Credit the original scene and renderer in Sources & Version.
- Keep persistent chapter navigation and search. On narrow screens, use a collapsible index and readable single-column layouts.
- Remove promotional introductions, decorative prose, repeated prompts, and recommended-reading blocks. Retain concise gameplay instructions, data, and necessary uncertainty notes.
- Use ordinary scrolling and instant navigation. Preserve search, filters, and the previous scroll position when returning with browser Back.
- Keep dense information readable, with keyboard-accessible controls, visible focus, reduced-motion support, and locally bundled fonts.
- Offer saved card/list views for fish, compact chapter headers on phones, chapter shortcuts in search, and section navigation in articles.
- Keep fish facts compact, offer sticky section shortcuts on fish and tackle entries, and preserve tackle filters through detail breadcrumbs. Show the current chapter in the phone menu button.

## Guide content

**Fish Atlas**

- Include every obtainable species and its relevant variants.
- Each entry shows artwork, locations, time conditions, preferred lures, compatible equipment by size, weight/value ranges, trophy thresholds, and practical catch advice.
- Distinguish ordinary catches, ice variants, trophy sizes, and legendary encounters.
- Filter by location, time of day, lure, fish size, rarity, and encounter type. Include clear reset and empty-result states.

**Legends & Trophies**

- Provide a dedicated legendary directory with exact locations, spawn windows, prerequisites, tackle, and sourced technique advice.
- Explain trophy thresholds and how trophy catches differ from legendary encounters.

**Waters**

- Organize every fishing spot by region, with artwork, unlock requirements, available fish, and equipment considerations.
- Let you select a location and time to see matching targets and their catch conditions.
- Link directly between locations, fish, and tackle.

**Tackle & Fieldcraft**

- Cover rods, lures, lines, boats, prices, upgrades, unlocks, and compatibility.
- Explain casting, retrieval, fish behavior, fighting, time changes, active/passive fishing, ice fishing, and progression through Rusty’s shop.

**The Rest of the Handbook**

- Include cabin restoration, pond stocking, fish viewing, trophy displays, achievements, companions, and cosmetics.
- Provide concise requirements and instructions, cross-linked to relevant fish and equipment.
- Separate announced content from content playable in the supported build.

## Data and implementation

- Use **React, TypeScript, Vite, and custom CSS**, producing a static app with no backend or account system. Provide local development, production build, and preview commands.
- Build a read-only importer using UnityPy, accepting `--game-dir`. Use the discovered installation as its default source.
- Extract game configuration, English names, and relevant artwork into a committed catalog snapshot. Record the game version and build alongside the resulting catalog.
- Model species separately from variants and location-specific catch conditions. Preserve distinctions between unrestricted times, restricted times, and unknown conditions.
- Supplement game data with original explanatory text informed by official updates and community guides. Attach sources to supplementary claims and label unresolved discrepancies.
- Reconcile coverage against the [community fish inventory](https://castnchill.unpack.wiki/docs/fish/) and [location inventory](https://castnchill.unpack.wiki/docs/locations/), checking active game configurations before including entries or calculating totals.
- Use bookmarkable hash routes for chapters and entries. Bundle data, artwork, and fonts for both local previews and public hosting.
- Document setup and how to regenerate the catalog after a game update. Track the prepared catalog and artwork; publish the verified build to GitHub Pages.

## Verification

- Validate catalog completeness, unique identifiers, cross-references, artwork availability, and rod/lure/size compatibility. Audit legendary encounter records individually.
- Test combined filters, aliases, unknown versus unrestricted times, ordinary versus ice variants, and trophy versus legendary classification.
- Check search, navigation, browser Back, keyboard operation, and layouts at desktop, split-screen, and phone widths.
- Run TypeScript checks, focused data/filter tests, and the production build. Verify that the built guide works with external network access disabled.
- Deliver populated chapters with sourced information; unresolved facts must be visibly identified rather than replaced with invented values.

## Refinement pass

- [x] Recompose the welcome page as artwork beside a compact chapter index, switching layout based on available book width. Preserve the original ascii.rest scene and proportions.
- [x] Keep pixel display text at whole-pixel sizes, increase small labels, reduce redundant borders, and unify spacing and focus states.
- [x] Show the locations, sizes, and time windows matching the current filters on fish cards. Use explicit uncertainty or a catch-window prompt when one time label cannot represent the conditions.
- [x] Collapse phone filters behind an explicit control, expose removable filter chips, and correct singular result labels.
- [x] Add modal focus wrapping, backdrop dismissal, scroll locking, Escape handling, and focus return to mobile navigation. Add arrow-key browsing to search results.
- [x] Restore the atlas scroll position with browser Back. Reformat catch-condition tables into labelled records on phones without sideways scrolling.
- [x] Iterate on screenshots at intermediate widths, tighten the chapter index, fix the short-page background, and move input focus rings around the complete search field.
- [x] Pass the complete headless/offline browser run after the final visual and interaction fixes.
- [x] Use the game's original dawn, day, dusk, and night sprites, mapped through the named game UI configuration and rendered at 2× scale. Use a clock for unrestricted or combined time windows; preserve the audited catch times.

## Implemented — 11 October 2026

- [x] All nine chapters populated, with warm paper/dark pine surfaces, charcoal navigation, copper accents, Fira Sans headings and reading text, and pixel branding and icons.
- [x] Replaced the original ASCII sketch with ascii.rest’s Alpine Dawn scene and renderer. Preserved the artwork’s composition, separated the title and controls, bundled the MIT licence, and added source credit.
- [x] Imported 68 fish entries, 16 legendary encounters, 17 locations, 38 tackle/transport items, 38 achievements, and 110 companion/appearance options.
- [x] Added 17 sourced handbook articles and reconciled fish/location IDs against the community inventories.
- [x] Implemented combined filters, whole-book search, variant links, size-specific tackle suggestions, bookmarkable routes, preserved filters, and weight units.
- [x] Bundled local fonts, 264 extracted sprites, and 12 official landscape illustrations for offline use with the local server.
- [x] Documented setup, read-only import, game-update workflow, interpretation limits, and sources in `README.md` and `docs/DATA_AUDIT.md`.
- [x] Passed catalog validation, eight focused domain tests, TypeScript, and the production build.
- [x] Condensed all 17 handbook articles and removed repeated reading recommendations and filler throughout the UI.
- [x] Passed isolated headless Playwright QA after refinement: 170 routes, 276 catalog assets, eight viewport widths from 320 to 1920 pixels, working animation pause/reduced-motion/offscreen suspension, no runtime errors, and no external requests.
- [x] Visually reviewed welcome, atlas, legend, fish detail, tackle, and handbook screenshots. Detail artwork loads eagerly; screenshot checks wait for visible images.

The project browser rule is saved in `AGENTS.md`. The requested global edit could not be applied because `~/.codex/AGENTS.md` is outside the writable workspace; `docs/global-browser-rule.patch` contains the prepared change and passes a dry-run check.

## Independent interfaces — 11 October 2026

The first set of CSS variations was rejected because it reused the same page structure. Replace those variations with independent applications while retaining Original:

- [x] **Sunday Cast:** magazine masthead and front page, story index, reading spreads, alphabetical species directory, natural-history detail pages, and photographic place articles.
- [x] **Drift:** full-width landscapes, oversized destination typography, a numbered water strip, and species browsing below each scene. Dedicated fish pages retain place/time context and provide size-specific catch windows and compatible tackle. Species search and separate reading pages replace Wayfinder's map/planning panel.
- [x] **Sonar:** a three-pane data reference, filterable/sortable species records, catch-window inspector, equipment table, and notes browser. Use a list-to-detail flow on phones.
- [x] **Pocket:** bound catch book with collectible cards, a persistent manual checklist, fish-card dialogs, destination postcards, and expandable notes. Keep the checklist entirely separate from game saves.
- [x] Remove the shared alternative-home template and CSS skins. Share only data/helpers and the design/appearance controls; the original reference retains its full coverage.
- [x] Replace the old picker previews and descriptions to reflect the actual interfaces. Preserve the existing saved design IDs and theme/unit preferences.
- [x] Rebuild and run the domain tests. Verify the complete Original reference with the existing isolated headless/offline suite.
- [x] Review all four interfaces visually in both appearances and at desktop/phone sizes; resolve layout, interaction, and contrast findings.
- [x] Complete each interface's primary task through the UI, including Pocket checklist persistence and keyboard dialog behavior.
- [x] Check secondary views, responsive layouts, short-window controls, and saved preferences with the replacement headless suite.

Verification before the Drift replacement: the independent-interface suite passed 364 screens across seven widths and two appearances, with no runtime errors, layout/contrast findings, or external requests. All four primary-task flows passed. The control suite passed 80 short-window cases plus keyboard switching between independent interfaces. The complete Original suite passed 172 routes, 276 assets, and 140 appearance layouts; all eight domain tests and the production build passed. These browser results cover the former Wayfinder design, not Drift.

Local screenshots and reports are in ignored `artifacts/redesigns/`. Imported art/data remain outside Git; this app is not deployed.

## Drift replacement — 11 October 2026

Replaced Wayfinder's component and stylesheet with Drift, a landscape-led interface with a numbered destination strip, fish galleries, full-page species details, and dedicated reading pages. Kept the saved `expedition` preference compatible so existing users receive the replacement. Updated the picker preview, appearance bootstrap, documentation, and browser scenarios.

Place/time context survives opening a fish, returning to its water, and browser history. Fish pages filter confirmed catch windows by water, time, and size and show compatible tackle. The pond has a separate stocking introduction. Species search includes aliases and legendary names.

Validation: production build, all eight domain tests, and catalog validation pass. Server-rendered smoke checks cover 224 route/unit combinations and 98 referenced local assets, including ice variants, legends, pond behavior, missing IDs, and preserved place/time links. These checks do not verify browser interactions or visual layout.

Headless Playwright verification now passes: `npm run test:e2e -- --drift-only` checks 169 screens, including seven widths in both appearances, the directory, and all 17 destination headings at three widths. Catch-window selection, compatible tackle, water/time context, Back/Forward, ice variants, search/empty states, note navigation, and saved preferences pass with no runtime errors, layout/contrast findings, or external requests. The design/display control suite also passes all 80 cases.

Screenshot-led refinements reduced the landscape's height to expose the fish section sooner, increased small text and touch targets, brightened the scenery, and made the phone destination label fit completely. Added a searchable water directory with a fixed search area and independently scrolling results. Browser iteration caught and fixed search movement during filtering, an oversized mobile search field that hid results, and keyboard focus escaping the dialog. Tests now assert visible results, stable search position, focus wrapping/return, short-window reachability, and the selected water remaining visible after resizing.

Final screenshots and the headless report are in `artifacts/redesigns/`; comparison images are in `artifacts/drift/before/`. Commit/push remain pending because the repository metadata is inaccessible in this session and the required live Git preflight cannot be completed.
