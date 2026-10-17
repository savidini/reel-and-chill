"""Scene loading, playback, visibility, resize and cleanup under the Pages base."""
import json
from playwright.sync_api import sync_playwright, expect
from pages_server import ROOT, pages_server
from theme_qa import CONTRAST_AUDIT


def snapshot(canvas):
    return canvas.evaluate('(canvas) => canvas.toDataURL()')


def check(base):
    errors, external = [], []
    artifacts = ROOT / 'artifacts' / 'scenes'
    artifacts.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for design, scene, title, route in [
            ('original', 'aurora-fjord', 'Aurora Fjord', '/home'),
            ('expedition', 'deep-reef', 'Deep Reef', '/waters/ocean1-spot2'),
        ]:
            context = browser.new_context(viewport={'width': 1440, 'height': 1000},
                                          color_scheme='light', reduced_motion='reduce')
            context.add_init_script(f"localStorage.setItem('cast-guide-design', {json.dumps(design)});")
            context.add_init_script('''
                window.sceneObservers = { ResizeObserver: new Set(), IntersectionObserver: new Set() };
                for (const name of Object.keys(sceneObservers)) {
                    const Observer = window[name];
                    window[name] = class extends Observer {
                        observe(element, ...args) {
                            if (element.matches('.ascii-canvas')) sceneObservers[name].add(this);
                            return super.observe(element, ...args);
                        }
                        disconnect() { sceneObservers[name].delete(this); super.disconnect(); }
                    };
                }
            ''')
            def local_only(request):
                if request.request.url.startswith(base):
                    request.continue_()
                else:
                    external.append(request.request.url)
                    request.abort()
            context.route('**/*', local_only)
            page = context.new_page()
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.on('response', lambda response: errors.append(f'{response.status}: {response.url}') if response.status >= 400 else None)
            page.goto(base + '#' + route)
            canvas = page.locator('.ascii-canvas')
            expect(canvas).to_have_attribute('data-ready', 'true')
            expect(page.locator('.ascii-scene')).to_have_attribute('data-scene', scene)
            canvas.scroll_into_view_if_needed()
            page.evaluate('document.fonts.ready')
            play = page.get_by_role('button', name=f'Play {title} animation')
            pause = page.get_by_role('button', name=f'Pause {title} animation')
            expect(play).to_have_attribute('aria-pressed', 'true')
            still = snapshot(canvas)
            page.wait_for_timeout(250)
            assert snapshot(canvas) == still, scene + ': reduced motion changed the frame'
            other = 'deep-reef' if scene == 'aurora-fjord' else 'aurora-fjord'
            resources = page.evaluate('performance.getEntriesByType("resource").map(entry => entry.name)')
            assert any('/assets/' + scene + '-' in url for url in resources), resources
            assert not any('/assets/' + other + '-' in url for url in resources), resources

            for theme in ['light', 'dark']:
                page.emulate_media(color_scheme=theme)
                for width in [1920, 1440, 1024, 820, 640, 390, 320]:
                    page.set_viewport_size({'width': width, 'height': 900})
                    canvas.scroll_into_view_if_needed()
                    box = canvas.bounding_box()
                    assert abs(box['width'] / box['height'] - 2) < .02, (scene, width, box)
                    page.wait_for_function('''() => {
                        const c = document.querySelector('.ascii-canvas');
                        return Math.abs(c.width - c.clientWidth * devicePixelRatio) <= 1;
                    }''')
                    assert page.evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1')
                    assert not page.evaluate(CONTRAST_AUDIT)['failures'], (scene, theme, width)
                    if width in [1440, 390]:
                        page.locator('.welcome-cover' if design == 'original' else '.d-reef-intro').screenshot(path=str(artifacts / f'{scene}-{theme}-{width}.png'))

            page.set_viewport_size({'width': 1440, 'height': 1000})
            canvas.scroll_into_view_if_needed()
            play.click()  # Explicit play overrides reduced motion, for this instance only.
            frame = snapshot(canvas)
            page.wait_for_function('(before) => document.querySelector(".ascii-canvas").toDataURL() !== before', arg=frame)
            pause.click()
            held = snapshot(canvas)
            assert held != still, scene + ': pause reset the playhead'
            page.wait_for_timeout(250)
            assert snapshot(canvas) == held, scene + ': paused animation still draws'

            # Hold the standard visibility signal while resuming: mount's first
            # frame must be exactly the paused one, before any clock advance.
            page.evaluate('''() => {
                Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
                document.dispatchEvent(new Event('visibilitychange'));
            }''')
            play.click()
            page.wait_for_timeout(250)
            assert snapshot(canvas) == held, scene + ': resume reset or advanced while hidden'
            page.evaluate("delete document.hidden; document.dispatchEvent(new Event('visibilitychange'))")
            page.wait_for_function('(before) => document.querySelector(".ascii-canvas").toDataURL() !== before', arg=held)

            page.evaluate('''() => {
                Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
                document.dispatchEvent(new Event('visibilitychange'));
            }''')
            held = snapshot(canvas)
            page.wait_for_timeout(250)
            assert snapshot(canvas) == held, scene + ': hidden animation still draws'
            page.evaluate("delete document.hidden; document.dispatchEvent(new Event('visibilitychange'))")
            page.wait_for_function('(before) => document.querySelector(".ascii-canvas").toDataURL() !== before', arg=held)

            page.evaluate('''() => {
                const spacer = document.createElement('div'); spacer.id = 'scene-test-spacer';
                spacer.style.height = '150vh'; document.body.append(spacer);
                scrollTo(0, document.documentElement.scrollHeight);
            }''')
            page.wait_for_function('document.querySelector(".ascii-canvas").getBoundingClientRect().bottom < 0')
            page.wait_for_timeout(150)
            held = snapshot(canvas)
            page.wait_for_timeout(250)
            assert snapshot(canvas) == held, scene + ': offscreen animation still draws'
            canvas.scroll_into_view_if_needed()
            page.wait_for_function('(before) => document.querySelector(".ascii-canvas").toDataURL() !== before', arg=held)
            page.evaluate("document.getElementById('scene-test-spacer').remove()")
            page.emulate_media(reduced_motion='no-preference')
            expect(pause).to_be_visible()
            page.emulate_media(reduced_motion='reduce')
            expect(play).to_be_visible()
            # Remove a playing scene and retain its canvas to detect late draws.
            play.click()
            page.evaluate("window.detachedScene = document.querySelector('.ascii-canvas'); location.hash = '/fish'")
            expect(canvas).to_have_count(0)
            held = page.evaluate('detachedScene.toDataURL()')
            page.set_viewport_size({'width': 640, 'height': 900})
            page.wait_for_timeout(250)
            assert page.evaluate('detachedScene.toDataURL()') == held
            assert page.evaluate('Object.values(sceneObservers).every(observers => observers.size === 0)'), 'Scene observers leaked'
            page.go_back()
            expect(canvas).to_have_attribute('data-ready', 'true')
            expect(play).to_have_attribute('aria-pressed', 'true')
            page.reload()
            expect(canvas).to_have_attribute('data-ready', 'true')
            expect(play).to_have_attribute('aria-pressed', 'true')
            if design == 'expedition':
                # All five ocean destinations get the reef; inland waters do not.
                for location in json.loads((ROOT / 'public/data/catalog.json').read_text())['locations']:
                    page.evaluate('(id) => location.hash = "/waters/" + id', location['id'])
                    expect(page.locator('#d-water-title')).to_have_text(location['name'] + '.')
                    expect(canvas).to_have_count(1 if location['kind'] == 'ocean' else 0)
            print(f'{title}: local chunk, proportions, playback, visibility, motion, routes and cleanup passed.', flush=True)
            context.close()
        browser.close()
    assert not errors and not external, (errors, external)
    (artifacts / 'report.json').write_text(json.dumps({'scenes': ['aurora-fjord', 'deep-reef'], 'headless': True, 'runtimeErrors': errors, 'externalRequests': external}, indent=2) + '\n')


if __name__ == '__main__':
    with pages_server() as base:
        check(base)
