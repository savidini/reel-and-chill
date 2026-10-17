"""Capture the five final interfaces in isolated, headless Chromium."""
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'tests'))
from pages_server import ROOT, pages_server
from playwright.sync_api import sync_playwright, expect

DESIGNS = [('original', 'original'), ('journal', 'sunday-cast'),
           ('expedition', 'drift'), ('sonar', 'sonar'), ('studio', 'pocket')]
VIEWPORTS = {'desktop': {'width': 1440, 'height': 1000},
             'mobile': {'width': 390, 'height': 844}}


def main():
    destination = ROOT / 'docs' / 'screenshots'
    destination.mkdir(parents=True, exist_ok=True)
    errors = []
    with pages_server() as base, sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for design, name in DESIGNS:
            for size, viewport in VIEWPORTS.items():
                context = browser.new_context(viewport=viewport, device_scale_factor=1,
                                              color_scheme='light', reduced_motion='reduce', locale='en-US')
                context.add_init_script(f'''localStorage.clear();
                    localStorage.setItem('cast-guide-design', {json.dumps(design)});
                    localStorage.setItem('cast-guide-theme', 'light');
                    localStorage.setItem('cast-guide-unit', 'lb');''')
                def local_only(route):
                    if route.request.url.startswith(base):
                        route.continue_()
                    else:
                        errors.append('External request: ' + route.request.url)
                        route.abort()
                context.route('**/*', local_only)
                page = context.new_page()
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.goto(base + '#/home')
                expect(page.locator('main')).to_be_visible()
                expect(page.locator('html')).to_have_attribute('data-design', design)
                page.evaluate('document.fonts.ready')
                page.wait_for_function('''() => [...document.images].every(image => {
                    const box = image.getBoundingClientRect();
                    return box.bottom <= 0 || box.top >= innerHeight ||
                        (image.complete && image.naturalWidth > 0);
                })''')
                if design == 'original':
                    expect(page.locator('.ascii-canvas')).to_have_attribute('data-ready', 'true')
                    expect(page.get_by_role('button', name='Play Aurora Fjord animation')).to_be_enabled()
                page.evaluate('''() => {
                    document.querySelectorAll(':popover-open').forEach(panel => panel.hidePopover());
                    document.activeElement?.blur();
                    scrollTo(0, 0);
                }''')
                page.evaluate('() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
                assert page.evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1')
                assert page.locator(':popover-open, dialog[open]').count() == 0
                path = destination / f'{name}-{size}.png'
                page.screenshot(path=str(path), full_page=False, animations='disabled')
                print(path.relative_to(ROOT), flush=True)
                context.close()
        browser.close()
    assert not errors, errors


if __name__ == '__main__':
    main()
