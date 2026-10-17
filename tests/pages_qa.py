"""Headless Pages smoke checks, also usable against the deployed URL."""
from contextlib import nullcontext
import argparse
import hashlib
import json
import re
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright, expect
from display_qa import choose_theme, choose_unit
from pages_server import ROOT, pages_server

DESIGNS = ['original', 'journal', 'expedition', 'sonar', 'studio']


def select_design(page, design):
    page.get_by_role('button', name='Change design, current:').click()
    picker = page.locator('#design-picker')
    picker.locator('label.design-option').filter(has=page.locator(f'input[value="{design}"]')).click()
    expect(page.locator('html')).to_have_attribute('data-design', design)
    if picker.is_visible():
        picker.get_by_role('button', name='Done', exact=True).click()


def settle(page):
    expect(page.locator('main')).to_be_visible()
    page.evaluate('document.fonts.ready')
    page.wait_for_function('''() => [...document.images].every(img => {
        const r = img.getBoundingClientRect();
        return !r.width || !r.height || r.bottom < 0 || r.top > innerHeight ||
            (img.complete && img.naturalWidth > 0);
    })''')


def check(base, live):
    artifacts = ROOT / 'artifacts' / ('live-pages' if live else 'pages')
    artifacts.mkdir(parents=True, exist_ok=True)
    errors, unexpected, screens = [], [], 0
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce')

        def same_site(route):
            if route.request.url.startswith(base):
                route.continue_()
            else:
                unexpected.append(route.request.url)
                route.abort()

        context.route('**/*', same_site)
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('response', lambda response: errors.append(f'{response.status}: {response.url}') if response.status >= 400 else None)
        page.goto(base)
        settle(page)
        expect(page.locator('html')).to_have_attribute('data-design', 'original')
        expect(page.locator('main h1')).to_have_text('Reel & Chill')
        expect(page.locator('meta[name="description"]')).to_have_attribute('content', re.compile('Reel & Chill.*Your Cast n Chill companion'))
        expect(page.locator('link[rel="icon"]')).to_have_attribute('href', urlsplit(base).path + 'favicon.svg')

        # No site-root fallback can hide an incorrect asset path in local QA.
        if not live:
            origin = base.split('/reel-and-chill/')[0]
            for path in ['/', '/data/catalog.json', '/fonts/CastPixel.ttf', '/game-assets/scenes/fork.webp', '/favicon.svg']:
                assert context.request.get(origin + path).status == 404, path

        for design in DESIGNS:
            page.goto(base + '#/home')
            settle(page)
            select_design(page, design)
            for width in [1440, 390, 320]:
                page.set_viewport_size({'width': width, 'height': 900})
                for theme in ['light', 'dark']:
                    choose_theme(page, theme)
                    settle(page)
                    expect(page).to_have_title(re.compile('Reel & Chill'))
                    assert page.evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1'), (design, width)
                    # Longer branding must not collide with the appearance controls.
                    if design != 'original':
                        brand = page.get_by_role('link', name='Reel & Chill home', exact=True)
                        expect(brand).to_be_visible()
                        box = brand.bounding_box()
                        controls = page.locator('.alt-utilities').bounding_box()
                        assert box['x'] + box['width'] <= controls['x'] + 1, (design, width, box, controls)
                    if width in [1440, 390] and theme == 'light':
                        page.screenshot(path=str(artifacts / f'{design}-{width}.png'), full_page=False)
                    screens += 1
            page.set_viewport_size({'width': 390, 'height': 900})
            page.goto(base + '#/fish/northern-pike')
            settle(page)
            expect(page).to_have_title(re.compile('Northern Pike.*Reel & Chill'))
            page.reload()
            settle(page)
            expect(page).to_have_title(re.compile('Northern Pike.*Reel & Chill'))
            expect(page.locator('html')).to_have_attribute('data-design', design)
            expect(page.locator('html')).to_have_attribute('data-theme', 'dark')
            print(f'Branding, themes, mobile layout and detail reload: {design}', flush=True)

        # Existing checklist key survives reloads and design changes.
        page.goto(base + '#/home')
        settle(page)
        caught = page.get_by_role('button', name='Mark Bluegill Sunfish as caught', exact=True)
        caught.click()
        page.reload()
        settle(page)
        expect(page.get_by_role('button', name='Unmark Bluegill Sunfish as caught', exact=True)).to_have_attribute('aria-pressed', 'true')
        choose_unit(page, 'kg')
        select_design(page, 'original')
        page.reload()
        settle(page)
        assert page.evaluate("localStorage.getItem('cast-guide-unit')") == 'kg'
        page.keyboard.press('Control+k')
        page.get_by_role('searchbox', name='Search the whole guide', exact=True).fill('northern pike')
        page.locator('.search-results a').filter(has_text='Northern Pike').first.click()
        expect(page).to_have_title(re.compile('Northern Pike.*Reel & Chill'))
        page.go_back()
        expect(page.locator('main h1')).to_have_text('Reel & Chill')

        # Loading and retry retain the route and saved display preferences.
        recovery = context.new_page()
        recovery.route('**/data/catalog.json', lambda route: route.fulfill(status=503, body='unavailable'))
        recovery.goto(base + '#/fish/northern-pike')
        expect(recovery.get_by_role('heading', name='Catalog unavailable')).to_be_visible()
        expect(recovery.locator('body')).not_to_contain_text('npm run')
        recovery.unroute('**/data/catalog.json')
        recovery.get_by_role('button', name='Try again').click()
        settle(recovery)
        expect(recovery).to_have_title(re.compile('Northern Pike.*Reel & Chill'))
        expect(recovery.locator('html')).to_have_attribute('data-theme', 'dark')
        assert recovery.evaluate("localStorage.getItem('cast-guide-unit')") == 'kg'
        recovery.close()

        # Verify every published file, even lazy artwork, fonts and licences.
        assets = sorted(path for path in (ROOT / 'dist').rglob('*') if path.is_file())
        for path in assets:
            url = base + path.relative_to(ROOT / 'dist').as_posix()
            response = context.request.get(url)
            assert response.ok, (url, response.status)
            assert hashlib.sha256(response.body()).digest() == hashlib.sha256(path.read_bytes()).digest(), f'Stale or incorrect asset: {url}'
        assert not errors, errors
        assert not unexpected, unexpected
        report = {'url': base, 'headless': True, 'screensChecked': screens, 'assetsChecked': len(assets), 'designs': DESIGNS, 'runtimeErrors': errors, 'unexpectedRequests': unexpected,
                  'checks': ['default Original', 'branding', 'themes', 'desktop and mobile', 'detail reload', 'search and Back', 'saved preferences and checklist', 'catalog retry', 'asset content hashes']}
        (artifacts / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
        print(json.dumps(report, indent=2))
        browser.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', help='Verify a deployed site instead of starting the local Pages server.')
    args = parser.parse_args()
    with nullcontext(args.url.rstrip('/') + '/') if args.url else pages_server() as base:
        check(base, bool(args.url))
