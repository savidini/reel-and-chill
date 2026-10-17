"""Isolated headless Playwright QA. Never attaches to the user's browser."""
from __future__ import annotations
import argparse
from functools import partial
from http.server import ThreadingHTTPServer
from pages_server import PagesHandler, PREFIX
import json
from pathlib import Path
import threading
import time
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright, expect
from theme_qa import check_themes
from display_qa import choose_unit

ROOT = Path(__file__).resolve().parent.parent
ARTIFACTS = ROOT / 'artifacts'



def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--screenshots-only', action='store_true')
    parser.add_argument('--refinement-only', action='store_true')
    parser.add_argument('--themes-only', action='store_true')
    parser.add_argument('--designs-only', action='store_true')
    parser.add_argument('--design-screenshots', action='store_true')
    parser.add_argument('--design-tasks', action='store_true')
    parser.add_argument('--drift-only', action='store_true')
    parser.add_argument('--search-stress', action='store_true')
    parser.add_argument('--design-controls', action='store_true')
    parser.add_argument('--achievements-only', action='store_true')
    args = parser.parse_args()
    if args.designs_only or args.design_screenshots or args.design_tasks or args.drift_only:
        from design_qa import main as design_main
        design_main(screenshots_only=args.design_screenshots, tasks_only=args.design_tasks, only_design='expedition' if args.drift_only else None)
        return
    if not (ROOT / 'dist/index.html').exists():
        raise SystemExit('Run npm run build before browser QA.')
    ARTIFACTS.mkdir(exist_ok=True)
    handler = partial(PagesHandler, directory=str(ROOT / 'dist'))
    server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    origin = f'http://127.0.0.1:{server.server_port}'
    base = origin + PREFIX.rstrip('/')
    issues = []
    external = []
    visited = set()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(viewport={'width': 1440, 'height': 1080}, device_scale_factor=1, reduced_motion='reduce')
            # External requests are blocked for the entire run, including fonts,
            # telemetry, CDN assets and APIs. Only this test's localhost is allowed.
            def offline_only(route):
                if route.request.url.startswith(origin + '/'):
                    route.continue_()
                else:
                    external.append(route.request.url)
                    route.abort()
            context.route('**/*', offline_only)
            page = context.new_page()
            page.set_default_timeout(10000)
            page.on('pageerror', lambda e: issues.append(str(e)))
            page.on('response', lambda r: issues.append(f'HTTP {r.status}: {r.url}') if r.status >= 400 else None)

            def visit(path):
                page.goto(base + path)
                expect(page.locator('main h1')).to_be_visible()
                page.evaluate('document.fonts.ready')
                # Route headings can render before visible lazy sprites load.
                # Review complete pages instead of capturing blank specimens.
                page.wait_for_function('''() => [...document.images].every(img => {
                    const rect = img.getBoundingClientRect();
                    return rect.bottom <= 0 || rect.top >= innerHeight ||
                        (img.complete && img.naturalWidth > 0);
                })''')
                assert 'Page not found' not in page.locator('main').inner_text(), path
                visited.add(path)

            def no_overflow():
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), f'Page overflows at {page.viewport_size}: {page.url}'

            if args.achievements_only:
                from achievement_qa import check_achievements
                report = check_achievements(page, visit, ARTIFACTS)
                assert not issues, issues
                assert not external, external
                report.update(headless=True, runtimeErrors=issues, externalRequests=external)
                (ARTIFACTS / 'achievements' / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
                print(json.dumps(report, indent=2))
                browser.close()
                return

            if args.search_stress:
                from search_stress import check_search_stress
                check_search_stress(page, visit)
                browser.close()
                return

            if args.design_controls:
                from design_controls_qa import check_design_controls
                checks = check_design_controls(page, visit)
                assert not issues, issues
                assert not external, external
                (ARTIFACTS / 'designs').mkdir(exist_ok=True)
                (ARTIFACTS / 'designs' / 'controls-report.json').write_text(json.dumps({'headless': True, 'panelChecks': checks, 'runtimeErrors': issues, 'externalRequests': external}, indent=2) + '\n')
                browser.close()
                return

            if args.themes_only:
                report = check_themes(page, context, base + '/', ARTIFACTS, visit, no_overflow)
                assert not issues, issues
                assert not external, external
                (ARTIFACTS / 'theme-report.json').write_text(json.dumps(report, indent=2) + '\n')
                browser.close()
                return

            visit('/')
            expect(page.locator('main h1')).to_have_text('Reel & Chill')
            expect(page.locator('.chapter-card')).to_have_count(9)
            expect(page.get_by_role('button', name='Play lake animation')).to_be_visible()
            no_overflow()
            page.screenshot(path=str(ARTIFACTS / 'welcome-desktop.png'), full_page=True)
            page.get_by_role('link', name='Open Fish Atlas').click()
            expect(page.locator('main h1')).to_have_text('Fish Atlas')
            page.get_by_role('link', name='Reel & Chill home').click()
            expect(page.locator('.welcome-scene')).to_be_visible()
            visit('/#/fish')
            expect(page.locator('.fish-card')).to_have_count(68)
            no_overflow()
            page.screenshot(path=str(ARTIFACTS / 'atlas-desktop.png'), full_page=False)
            visit('/#/fish/northern-pike')
            expect(page.locator('.legend-callout')).to_contain_text('Night')
            page.screenshot(path=str(ARTIFACTS / 'fish-detail-desktop.png'), full_page=False)
            visit('/#/legends')
            expect(page.locator('.fish-card')).to_have_count(16)
            page.screenshot(path=str(ARTIFACTS / 'legends-desktop.png'), full_page=False)
            for fish, period in [('common-carp', 'dawn'), ('cutthroat-trout', 'day'), ('burbot', 'dusk'), ('northern-pike', 'night')]:
                visit(f'/#/fish/{fish}')
                page.locator('.conditions-table').screenshot(path=str(ARTIFACTS / f'time-{period}.png'))
            for width, name in [(640, 'split-screen'), (390, 'phone')]:
                page.set_viewport_size({'width': width, 'height': 960})
                visit('/#/home')
                no_overflow()
                page.screenshot(path=str(ARTIFACTS / f'welcome-{name}.png'), full_page=True)
                visit('/#/fish')
                no_overflow()
                page.screenshot(path=str(ARTIFACTS / f'atlas-{name}.png'), full_page=False)
                visit('/#/fish/ice-tiger-muskie')
                no_overflow()
                page.screenshot(path=str(ARTIFACTS / f'fish-detail-{name}.png'), full_page=False)
            if args.screenshots_only:
                assert not issues, issues
                assert not external, external
                print('Screenshots captured at 1440, 640 and 390 pixels; no runtime errors or external requests.')
                browser.close()
                return


            from search_stress import check_search_stress
            check_search_stress(page, visit)
            theme_report = check_themes(page, context, base + '/', ARTIFACTS, visit, no_overflow)
            print('Checking detail shortcuts, sticky header clearance, and tackle filter return…', flush=True)
            for width in [1440, 390]:
                page.set_viewport_size({'width': width, 'height': 960})
                visit('/#/fish/northern-pike?time=night&size=xxl')
                detail_url = page.url
                navigation = page.get_by_role('navigation', name='On this page')
                navigation.get_by_role('button', name='Tackle', exact=True).click()
                target = page.get_by_role('heading', name='Compatible tackle', exact=True)
                expect(target).to_be_focused()
                nav_box = navigation.bounding_box()
                assert target.bounding_box()['y'] >= nav_box['y'] + nav_box['height'], 'Section heading hidden behind sticky navigation'
                assert page.url == detail_url, 'Section shortcuts must preserve route filters'
                page.screenshot(path=str(ARTIFACTS / f'detail-tackle-jump-{width}.png'))
                navigation.get_by_role('button', name='Conditions', exact=True).click()
                expect(page.get_by_role('heading', name='Catch conditions', exact=True)).to_be_focused()
                no_overflow()

            visit('/#/tackle?kind=rod&mode=ice&q=hardwater')
            tackle_url = page.url
            expect(page.locator('.equipment-card')).to_have_count(1)
            page.locator('.equipment-card').click()
            page.get_by_role('navigation', name='On this page').get_by_role('button', name='Upgrades', exact=True).click()
            expect(page.get_by_role('heading', name='Upgrades', exact=True)).to_be_focused()
            page.locator('.breadcrumb a').click()
            assert page.url == tackle_url, 'Tackle breadcrumb must preserve equipment filters'
            expect(page.locator('.equipment-card')).to_have_count(1)
            expect(page.get_by_role('searchbox', name='Search tackle', exact=True)).to_have_value('hardwater')
            page.set_viewport_size({'width': 1440, 'height': 900})
            print('Checking cover search, chapter shortcuts, list view, and article navigation…', flush=True)
            visit('/#/home')
            cover_search = page.get_by_role('button', name='Search fish, waters, tackle…', exact=False)
            cover_search.click()
            expect(page.get_by_role('searchbox', name='Search the whole guide', exact=True)).to_be_focused()
            expect(page.locator('.search-chapters a')).to_have_count(6)
            page.keyboard.press('Escape')
            expect(cover_search).to_be_focused()
            cover_search.click()
            page.locator('.search-chapters').get_by_role('link', name='Fieldcraft', exact=True).click()
            expect(page.locator('main h1')).to_have_text('Fieldcraft')
            expect(page.get_by_role('dialog', name='Search the guide', exact=True)).not_to_be_visible()

            visit('/#/handbook/cabin-restoration')
            page.get_by_role('navigation', name='On this page').get_by_role('button', name='Interior repairs').click()
            expect(page.get_by_role('heading', name='Interior repairs', exact=True)).to_be_focused()
            assert page.get_by_role('heading', name='Interior repairs', exact=True).bounding_box()['y'] >= 72
            no_overflow()

            visit('/#/fish?q=northern+pike&encounter=legendary&time=night&water=lake1-spot2&size=xxl&variant=open-water')
            original_url = page.url
            page.get_by_role('button', name='Show fish as list', exact=True).click()
            expect(page.get_by_role('button', name='Show fish as list', exact=True)).to_have_attribute('aria-pressed', 'true')
            page.reload()
            expect(page.locator('.fish-list .fish-card')).to_have_count(1)
            expect(page.locator('.fish-card .fish-location')).to_have_text('Underwater Meadow')
            expect(page.locator('.fish-card .condition-caption')).to_have_text('Night')
            expect(page.locator('.fish-card .sizes')).to_have_text('XXL')
            assert page.url == original_url, 'Changing the display must retain the current filters'
            page.locator('.fish-card').click()
            expect(page.locator('main h1')).to_have_text('Northern Pike')
            page.go_back()
            expect(page.locator('.fish-list .fish-card')).to_have_count(1)
            page.get_by_role('button', name='Show fish as cards', exact=True).click()
            expect(page.locator('.fish-list')).to_have_count(0)

            print('Checking refined filters, keyboard search, mobile drawer and scroll restoration…', flush=True)
            page.set_viewport_size({'width': 1440, 'height': 900})
            visit('/#/fish?q=northern+pike&encounter=legendary&time=night&water=lake1-spot2&size=xxl&variant=open-water')
            expect(page.locator('.fish-card')).to_have_count(1)
            expect(page.locator('.fish-card .fish-location')).to_have_text('Underwater Meadow')
            expect(page.locator('.fish-card .condition-caption')).to_have_text('Night')
            expect(page.locator('.fish-card .sizes')).to_have_text('XXL')
            page.get_by_role('button', name='Remove time of day filter: Night').click()
            expect(page.get_by_label('Time of day', exact=True)).to_have_value('')
            assert 'time=' not in page.url

            visit('/#/fish')
            card = page.locator('.fish-card').nth(20)
            card.scroll_into_view_if_needed()
            prior_scroll = page.evaluate('scrollY')
            assert prior_scroll > 800
            card.click()
            expect(page.locator('.fish-feature')).to_be_visible()
            page.wait_for_function('scrollY === 0')
            page.go_back()
            expect(page.locator('.fish-card')).to_have_count(68)
            page.wait_for_function('(before) => Math.abs(scrollY - before) <= 4', arg=prior_scroll)

            search_button = page.get_by_role('button', name='Search guide', exact=True)
            search_button.click()
            search = page.get_by_role('searchbox', name='Search the whole guide', exact=True)
            search.fill('pike')
            results = page.locator('.search-results a')
            expect(results.nth(1)).to_be_visible()
            page.keyboard.press('ArrowDown')
            expect(results.first).to_be_focused()
            page.keyboard.press('ArrowDown')
            expect(results.nth(1)).to_be_focused()
            destination = results.nth(1).get_attribute('href')
            page.keyboard.press('Enter')
            expect(page.get_by_role('dialog', name='Search the guide', exact=True)).not_to_be_visible()
            assert page.url.endswith(destination)
            search_button.click()
            search.fill('salmon')
            page.screenshot(path=str(ARTIFACTS / 'search-desktop.png'))
            page.keyboard.press('Escape')
            expect(search_button).to_be_focused()
            assert page.evaluate('document.body.style.overflow') != 'hidden'

            # Cover and atlas at intermediate and wide desktop sizes.
            for width in [1920, 1280, 1024, 820]:
                page.set_viewport_size({'width': width, 'height': 900})
                visit('/#/home')
                no_overflow()
                page.screenshot(path=str(ARTIFACTS / f'welcome-{width}.png'), full_page=True)
                visit('/#/fish')
                no_overflow()
                page.screenshot(path=str(ARTIFACTS / f'atlas-{width}.png'))

            page.set_viewport_size({'width': 390, 'height': 844})
            visit('/#/home')
            menu = page.get_by_role('button', name='Open chapter index', exact=True)
            menu.click()
            drawer = page.get_by_role('dialog', name='Chapter index', exact=True)
            expect(drawer).to_be_visible()
            assert page.evaluate('document.body.style.overflow') == 'hidden'
            page.screenshot(path=str(ARTIFACTS / 'navigation-phone.png'))
            for _ in range(16):
                page.keyboard.press('Tab')
                assert page.evaluate('document.activeElement.closest(".chapter-drawer") !== null'), 'Focus escaped the mobile menu'
            page.keyboard.press('Escape')
            expect(drawer).not_to_be_visible()
            expect(menu).to_be_focused()
            assert page.evaluate('document.body.style.overflow') != 'hidden'
            menu.click()
            page.mouse.click(350, 400)
            expect(drawer).not_to_be_visible()
            menu.click()
            drawer.get_by_role('link', name='Fish Atlas', exact=False).click()
            expect(page.locator('main h1')).to_have_text('Fish Atlas')
            expect(drawer).not_to_be_visible()
            expect(page.locator('main')).to_be_focused()

            # Phone filters are explicit, compact and retain visible chips.
            expect(page.get_by_label('Fishing spot', exact=True)).not_to_be_visible()
            page.get_by_role('button', name='Filters', exact=True).click()
            page.get_by_label('Time of day', exact=True).select_option('night')
            page.get_by_label('Encounter', exact=True).select_option('legendary')
            page.get_by_role('searchbox', name='Search fish', exact=True).fill('Northern Pike')
            page.get_by_label('Fishing mode', exact=True).select_option('open-water')
            expect(page.locator('.fish-card')).to_have_count(1)
            no_overflow()
            page.screenshot(path=str(ARTIFACTS / 'filters-phone.png'), full_page=True)
            page.locator('.filter-toggle').click()
            expect(page.get_by_label('Fishing spot', exact=True)).not_to_be_visible()
            expect(page.get_by_role('button', name='Remove time of day filter: Night')).to_be_visible()
            page.get_by_role('button', name='Remove time of day filter: Night').click()
            assert 'time=' not in page.url

            visit('/#/fish/northern-pike')
            page.get_by_role('heading', name='Catch conditions', exact=True).evaluate('(el) => el.scrollIntoView({block: "start"})')
            no_overflow()
            assert page.locator('.conditions-table').evaluate('(el) => el.scrollWidth <= el.clientWidth + 1')
            page.screenshot(path=str(ARTIFACTS / 'catch-conditions-phone.png'))
            page.get_by_role('button', name='Open chapter index', exact=True).click()
            page.set_viewport_size({'width': 1440, 'height': 900})
            expect(drawer).not_to_be_visible()
            expect(page.locator('.desktop-sidebar')).to_be_visible()
            assert page.evaluate('document.body.style.overflow') != 'hidden'
            if args.refinement_only:
                assert not issues, issues
                assert not external, external
                print('Refinement checks passed; no runtime errors or external requests.')
                browser.close()
                return

            page.set_viewport_size({'width': 1440, 'height': 1080})
            visit('/#/tackle/rod10')
            page.screenshot(path=str(ARTIFACTS / 'tackle-detail-desktop.png'), full_page=True)
            visit('/#/handbook')
            page.screenshot(path=str(ARTIFACTS / 'handbook-desktop.png'), full_page=True)
            visit('/#/home')
            page.emulate_media(reduced_motion='no-preference')
            pause = page.get_by_role('button', name='Pause lake animation')
            expect(pause).to_be_visible()
            scene = page.locator('.ascii-lake')
            frame = scene.evaluate('(canvas) => canvas.toDataURL()')
            page.wait_for_function('(before) => document.querySelector(".ascii-lake").toDataURL() !== before', arg=frame)
            pause.click()
            expect(page.get_by_role('button', name='Play lake animation')).to_have_attribute('aria-pressed', 'true')
            frame = scene.evaluate('(canvas) => canvas.toDataURL()')
            page.wait_for_timeout(250)
            assert scene.evaluate('(canvas) => canvas.toDataURL()') == frame, 'Paused lake continues to animate'
            page.get_by_role('button', name='Play lake animation').click()
            page.wait_for_function('(before) => document.querySelector(".ascii-lake").toDataURL() !== before', arg=frame)
            # The third-party scene must suspend when scrolled offscreen and
            # resume on return, so the guide stays quiet beside the game.
            # A scroll spacer lets a short cover exercise offscreen suspension.
            page.locator('.home-page').evaluate('(el) => el.style.paddingBottom = "100vh"')
            page.evaluate('scrollTo(0, document.documentElement.scrollHeight)')
            page.wait_for_function('document.querySelector(".ascii-lake").getBoundingClientRect().bottom < 0')
            page.wait_for_timeout(200)
            frame = scene.evaluate('(canvas) => canvas.toDataURL()')
            page.wait_for_timeout(250)
            assert scene.evaluate('(canvas) => canvas.toDataURL()') == frame, 'Offscreen lake continues to animate'
            page.evaluate('scrollTo(0, 0)')
            page.wait_for_function('(before) => document.querySelector(".ascii-lake").toDataURL() !== before', arg=frame)
            page.locator('.home-page').evaluate('(el) => el.style.paddingBottom = ""')
            page.set_viewport_size({'width': 1440, 'height': 1080})
            page.emulate_media(reduced_motion='reduce')
            expect(page.get_by_role('button', name='Play lake animation')).to_be_visible()
            print('Checking filters, history, keyboard search, units and location sessions…', flush=True)
            visit('/#/fish')
            page.get_by_role('searchbox', name='Search fish', exact=True).fill('Northern Pike')
            # Prefix search also finds Northern Pikeminnow.
            expect(page.locator('.fish-card')).to_have_count(3)
            page.get_by_label('Fishing mode', exact=True).select_option('open-water')
            page.get_by_label('Encounter', exact=True).select_option('legendary')
            page.get_by_label('Time of day', exact=True).select_option('day')
            expect(page.locator('.empty-state')).to_be_visible()
            page.get_by_label('Time of day', exact=True).select_option('night')
            expect(page.locator('.fish-card')).to_have_count(1)
            before = page.url
            page.locator('.fish-card').click()
            expect(page.locator('main h1')).to_have_text('Northern Pike')
            page.go_back()
            expect(page.get_by_role('searchbox', name='Search fish', exact=True)).to_have_value('Northern Pike')
            expect(page.get_by_label('Time of day', exact=True)).to_have_value('night')
            assert page.url == before
            page.get_by_role('button', name='Reset', exact=False).click()
            expect(page.locator('.fish-card')).to_have_count(68)
            page.get_by_role('combobox', name='Sort fish', exact=True).select_option('name')
            assert 'American Shad' in page.locator('.fish-card').first.inner_text()

            # Keyboard search, focus trapping, Enter selection, and Escape return.
            search_button = page.get_by_role('button', name='Search', exact=False)
            search_button.focus()
            page.keyboard.press('Control+k')
            expect(page.get_by_role('dialog')).to_be_visible()
            search = page.get_by_role('searchbox', name='Search the whole guide', exact=True)
            expect(search).to_be_focused()
            search.fill('salt king')
            expect(page.locator('.search-results a').first).to_contain_text('King Salmon')
            page.keyboard.press('Enter')
            expect(page.locator('main h1')).to_have_text('King Salmon')
            expect(page.get_by_role('dialog')).not_to_be_visible()
            search_button.click()
            search.fill('pond stocking')
            expect(page.locator('.search-results')).to_contain_text('Pond stocking')
            page.keyboard.press('Escape')
            expect(page.get_by_role('dialog')).not_to_be_visible()
            expect(search_button).to_be_focused()

            visit('/#/fish/ice-tiger-muskie')
            page.get_by_label('Target tackle size', exact=True).select_option('xxl')
            expect(page.locator('.setup-columns')).to_contain_text('Hardwater Howler')
            expect(page.locator('.setup-columns')).not_to_contain_text('Grizzly Pole')
            choose_unit(page, 'kg')
            expect(page.locator('.fish-facts')).to_contain_text('kg')
            page.reload()
            expect(page.locator('input[name="weight-unit"]:checked')).to_have_value('kg')
            choose_unit(page, 'lb')

            visit('/#/waters/lake1-spot2')
            page.get_by_label('Encounter', exact=True).select_option('legendary')
            page.get_by_label('Time of day', exact=True).select_option('day')
            expect(page.locator('.empty-state')).to_be_visible()
            page.get_by_label('Time of day', exact=True).select_option('night')
            expect(page.locator('.water-target')).to_have_count(1)
            expect(page.locator('.water-target')).to_contain_text('Northern Pike')

            visit('/#/legends?time=night')
            legend_count = page.locator('.fish-card').count()
            page.locator('.fish-card').first.click()
            page.locator('.breadcrumb').get_by_role('link', name='Legends & Trophies', exact=False).click()
            expect(page.get_by_label('Time of day', exact=True)).to_have_value('night')
            expect(page.locator('.fish-card')).to_have_count(legend_count)
            assert 'from=' not in page.url

            catalog = json.loads((ROOT / 'public/data/catalog.json').read_text())
            articles = json.loads((ROOT / 'src/content/articles.json').read_text())
            routes = ['/home', '/fish', '/legends', '/waters', '/tackle', '/handbook', '/cabin', '/achievements', '/wardrobe', '/sources']
            routes += ['/fish/' + x['id'] for x in catalog['fish']]
            routes += ['/waters/' + x['id'] for x in catalog['locations']]
            routes += ['/tackle/' + x['id'] for x in catalog['equipment']]
            routes += ['/handbook/' + x['id'] for x in articles]
            links = set()
            for route in routes:
                visit('/#' + route)
                no_overflow()
                links.update(page.locator('main a[href^="#/"]').evaluate_all('(els) => els.map(e => e.getAttribute("href"))'))
            print(f'Checked {len(routes)} chapter/detail routes; following all cross-links…', flush=True)
            for link in sorted(links):
                if '/' + link not in visited:
                    visit('/' + link)
            # Request every referenced local artifact, including lazy images far
            # below the fold, instead of assuming an unloaded image is valid.
            paths = {row['image'] for key in ['fish', 'equipment', 'achievements', 'cosmetics', 'areas'] for row in catalog[key] if row['image']}
            paths.update(catalog['timeIcons'].values())
            paths.update('/game-assets/scenes/' + name + '.webp' for name in json.loads((ROOT / 'scripts/scenes.json').read_text()))
            for path in paths:
                response = context.request.get(base + path)
                assert response.ok and len(response.body()) > 50, path

            # Narrow-window navigation and overflow on every major layout type.
            for width in [640, 390, 320]:
                print(f'Checking responsive layouts and navigation at {width}px…', flush=True)
                page.set_viewport_size({'width': width, 'height': 900})
                for path in ['/home', '/fish', '/fish/northern-pike', '/waters', '/waters/lake1-spot2', '/tackle', '/tackle/rod10', '/handbook', '/handbook/cabin-restoration', '/cabin', '/achievements', '/wardrobe', '/sources']:
                    visit('/#' + path)
                    no_overflow()
                page.get_by_role('button', name='Open chapter index').click()
                expect(page.get_by_role('navigation', name='Chapters')).to_be_visible()
                page.get_by_role('navigation', name='Chapters').get_by_role('link', name='Fish Atlas', exact=False).click()
                expect(page.locator('main h1')).to_have_text('Fish Atlas')
                expect(page.get_by_role('button', name='Open chapter index')).to_have_attribute('aria-expanded', 'false')

            page.set_viewport_size({'width': 1440, 'height': 1080})
            visit('/#/fish')
            page.keyboard.press('Control+Home')
            page.keyboard.press('Tab')
            # A failed catalog request shows a useful message and can recover.
            missing = context.new_page()
            missing.route('**/data/catalog.json', lambda r: r.fulfill(status=404, body='missing'))
            missing.goto(base + '/')
            expect(missing.get_by_role('heading', name='Catalog unavailable')).to_be_visible()
            missing.unroute('**/data/catalog.json')
            missing.get_by_role('button', name='Try again').click()
            expect(missing.locator('main h1')).to_be_visible()
            missing.close()
            assert not external, f'External requests while browsing offline: {external}'
            assert not issues, f'Runtime errors: {issues}'
            report = {'headless': True, 'externalNetworkBlocked': True, 'routesChecked': len(visited), 'assetsChecked': len(paths), 'viewports': [1920, 1440, 1280, 1024, 820, 640, 390, 320], 'refinementChecks': ['matching card conditions', 'removable filters', 'phone filter disclosure', 'history scroll restoration', 'keyboard search', 'modal focus and dismissal', 'narrow catch tables'], 'runtimeErrors': issues, 'externalRequests': external}
            report['appearance'] = theme_report
            report['browsingChecks'] = ['cover search and focus return', 'search chapter shortcuts', 'article section navigation', 'saved fish display mode', 'list filters and Back navigation']
            (ARTIFACTS / 'browser-report.json').write_text(json.dumps(report, indent=2) + '\n')
            print(json.dumps(report, indent=2))
            browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    main()
