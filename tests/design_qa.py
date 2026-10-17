"""Headless, offline review of four independent interfaces and their main tasks."""
from __future__ import annotations
from functools import partial
from http.server import ThreadingHTTPServer
from pages_server import PagesHandler, PREFIX
import json
from pathlib import Path
import threading
from playwright.sync_api import sync_playwright, expect
from theme_qa import CONTRAST_AUDIT
from display_qa import choose_theme, choose_unit

ROOT = Path(__file__).resolve().parent.parent
ARTIFACTS = ROOT / 'artifacts' / 'redesigns'
DESIGNS = {'journal': 'Sunday Cast', 'expedition': 'Drift', 'sonar': 'Sonar', 'studio': 'Pocket'}
LAYOUTS = {
    'journal': {'home': '/home', 'species': '/fish', 'fish': '/fish/northern-pike', 'places': '/waters', 'place': '/waters/lake1-spot2', 'gear': '/tackle', 'stories': '/handbook', 'story': '/handbook/cabin-restoration'},
    'expedition': {'home': '/home', 'place': '/waters/lake1-spot2', 'ocean': '/waters/ocean1-spot2', 'fish': '/fish/northern-pike', 'species': '/fish', 'ice': '/waters/ice1-spot1', 'cabin': '/waters/cabin1', 'notes': '/handbook', 'story': '/handbook/ice-fishing'},
    'sonar': {'database': '/home', 'fish': '/fish/northern-pike', 'equipment': '/tackle', 'gear': '/tackle/rod10', 'notes': '/handbook', 'note': '/handbook/fighting-fish'},
    'studio': {'book': '/home', 'card': '/fish/northern-pike', 'postcards': '/waters', 'postcard': '/waters/lake1-spot2', 'notes': '/handbook', 'note': '/handbook/fighting-fish'},
}


def main(screenshots_only=False, tasks_only=False, only_design=None):
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(PagesHandler, directory=str(ROOT / 'dist')))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    origin = f'http://127.0.0.1:{server.server_port}'
    base = origin + PREFIX.rstrip('/')
    issues, external, failures = [], [], []
    checks = 0
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(viewport={'width':1440,'height':1000}, reduced_motion='reduce', color_scheme='light')
            def offline(route):
                if route.request.url.startswith(origin + '/'): route.continue_()
                else:
                    external.append(route.request.url)
                    route.abort()
            context.route('**/*', offline)
            page = context.new_page()
            page.on('pageerror', lambda e: issues.append(str(e)))
            page.on('response', lambda r: issues.append(f'HTTP {r.status}: {r.url}') if r.status >= 400 else None)
            page.goto(base + '/')
            expect(page.locator('main')).to_be_visible()

            def settle():
                page.evaluate('document.fonts.ready')
                page.evaluate('() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
                page.wait_for_function('''() => [...document.images].every(img => {
                    const r=img.getBoundingClientRect();
                    return !r.width || !r.height || r.bottom<0 || r.top>innerHeight || (img.complete && img.naturalWidth>0);
                })''')

            def visit(path):
                page.evaluate('(path)=>location.hash=path', path)
                settle()
                page.evaluate('scrollTo(0,0)')

            def select_design(design):
                visit('/home')
                page.get_by_role('button', name='Change design, current:').click()
                picker = page.locator('#design-picker')
                expect(picker).to_be_visible()
                picker.locator('label.design-option').filter(has=page.locator(f'input[value="{design}"]')).click()
                expect(page.locator('html')).to_have_attribute('data-design',design)
                settle()
                if picker.is_visible(): picker.get_by_role('button', name='Done',exact=True).click()
                settle()

            def audit(label, modal=False):
                nonlocal checks
                checks += 1
                if not page.evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth+1'):
                    failures.append({'screen':label,'failure':'page overflow'})
                if page.locator('.d-specimen .d-back').count():
                    back = page.locator('.d-specimen .d-back').bounding_box()
                    header = page.locator('.d-header').bounding_box()
                    if back['y'] < header['y'] + header['height']:
                        failures.append({'screen':label,'failure':'specimen Back link covered by header'})
                if not modal:
                    for selector in ['.design-trigger','.display-trigger']:
                        box=page.locator(selector).bounding_box()
                        if box is None or box['x']<0 or box['x']+box['width']>page.viewport_size['width']+1:
                            failures.append({'screen':label,'failure':f'clipped control {selector}','box':box})
                result = page.evaluate(CONTRAST_AUDIT)
                if result['failures']: failures.append({'screen':label,'contrast':result['failures'][:12]})

            selected_designs = {only_design: DESIGNS[only_design]} if only_design else DESIGNS
            for design,name in selected_designs.items():
                print(f'Reviewing {name}…',flush=True)
                page.set_viewport_size({'width':1440,'height':1000})
                select_design(design)
                expect(page.locator('.guide-shell')).to_have_count(0)
                expect(page.locator('.chapter-hero')).to_have_count(0)
                for theme in ([] if tasks_only else ['light','dark']):
                    choose_theme(page,theme)
                    for width,height in ([(1440,1000),(390,844),(320,740)] if screenshots_only else [(1920,1080),(1440,1000),(1024,768),(820,1000),(640,900),(390,844),(320,740)]):
                        page.set_viewport_size({'width':width,'height':height})
                        layouts={'home':'/home'} if screenshots_only else LAYOUTS[design]
                        for key,path in layouts.items():
                            visit(path)
                            audit(f'{design}/{theme}/{width}/{key}',modal=design=='studio' and key=='card')
                            if width in [1440,390,320] and (screenshots_only or key in ['home','map','database','book','fish','plan','card','story','postcard']):
                                page.screenshot(path=str(ARTIFACTS/f'{design}-{theme}-{width}-{key}.png'), full_page=False)
                                if design == 'expedition' and key == 'home':
                                    page.locator('#d-below').screenshot(path=str(ARTIFACTS/f'{design}-{theme}-{width}-catches.png'))
                                    page.get_by_role('button',name='All waters',exact=True).click()
                                    directory = page.get_by_role('dialog',name='Choose a water.',exact=True)
                                    expect(directory).to_be_visible()
                                    settle()
                                    audit(f'{design}/{theme}/{width}/directory')
                                    directory.screenshot(path=str(ARTIFACTS/f'{design}-{theme}-{width}-directory.png'))
                                    page.keyboard.press('Escape')
                                    expect(directory).not_to_be_visible()
                                    expect(page.get_by_role('button',name='All waters',exact=True)).to_be_focused()
                        visit('/home')
                visit('/home')
                (ARTIFACTS/'layout-findings.json').write_text(json.dumps({'screenChecks':checks,'failures':failures},indent=2)+'\n')
                if not screenshots_only:
                    # Each interface's distinct primary task, through its own controls.
                    page.set_viewport_size({'width':1440,'height':1000})
                    choose_theme(page,'light')
                    if design=='journal':
                        page.get_by_role('link',name='Species index',exact=True).click()
                        page.get_by_role('searchbox',name='Find a species').fill('pike')
                        expect(page.locator('.j-species-index>a')).to_have_count(4)
                        page.locator('.j-species-index>a').filter(has=page.get_by_role('heading',name='Northern Pike',exact=True)).click()
                        expect(page.get_by_role('heading',name='Northern Pike',exact=True)).to_be_visible()
                        expect(page.locator('.j-legend-note')).to_contain_text('Toothy Terror')
                        page.get_by_role('link',name='Read the tackle notes').click()
                        expect(page.get_by_role('heading',name='Tackle compatibility',exact=True)).to_be_visible()
                        page.get_by_role('button',name='01 /').click()
                    elif design=='expedition':
                        page.get_by_role('button',name='All waters',exact=True).click()
                        directory = page.get_by_role('dialog',name='Choose a water.',exact=True)
                        expect(directory.get_by_role('searchbox',name='Find a water')).to_be_focused()
                        expect(directory.locator('.d-directory-list>a')).to_have_count(17)
                        search_before = directory.get_by_role('searchbox',name='Find a water').bounding_box()
                        directory.get_by_role('searchbox',name='Find a water').fill('underwater')
                        expect(directory.locator('.d-directory-list>a')).to_have_count(1)
                        search_after = directory.get_by_role('searchbox',name='Find a water').bounding_box()
                        assert abs(search_before['y']-search_after['y'])<=1, f"Water search moved while typing: {search_before['y']} → {search_after['y']}"
                        directory.get_by_role('link',name='Underwater Meadow',exact=False).click()
                        expect(directory).not_to_be_visible()
                        expect(page.get_by_role('heading',name='Underwater Meadow',exact=True)).to_be_visible()
                        page.get_by_role('button',name='Meet the fish',exact=True).click()
                        expect(page.locator('#d-below')).to_be_focused()
                        page.get_by_role('button',name='Night',exact=True).click()
                        page.locator('.d-fish-link').filter(has_text='Northern Pike').click()
                        expect(page.locator('.d-specimen h1')).to_contain_text('Northern Pike')
                        expect(page.get_by_role('button',name='Night',exact=True)).to_have_attribute('aria-pressed','true')
                        page.go_back()
                        expect(page.get_by_role('heading',name='Underwater Meadow',exact=True)).to_be_visible()
                        expect(page.get_by_role('button',name='Night',exact=True)).to_have_attribute('aria-pressed','true')
                        page.go_forward()
                        expect(page.locator('.d-specimen h1')).to_contain_text('Northern Pike')
                        page.get_by_role('button',name='XXL',exact=True).click()
                        expect(page.locator('.d-window-list')).to_contain_text('Toothy Terror')
                        expect(page.locator('.d-window-list')).to_contain_text('Night')
                        expect(page.locator('.d-kit-list>div')).to_have_count(2)
                        page.get_by_role('link',name='Back to Underwater Meadow',exact=True).click()
                        expect(page.get_by_role('heading',name='Underwater Meadow',exact=True)).to_be_visible()
                        expect(page.get_by_role('button',name='Night',exact=True)).to_have_attribute('aria-pressed','true')
                        page.set_viewport_size({'width':390,'height':844})
                        page.wait_for_function('''() => {
                            const strip=document.querySelector('.d-stops')?.getBoundingClientRect();
                            const current=document.querySelector('.d-stops [aria-current]')?.getBoundingClientRect();
                            if (!strip || !current) return false;
                            return current.left>=strip.left-1 && current.right<=strip.right+1;
                        }''')
                        page.get_by_role('button',name='All waters',exact=True).click()
                        directory.get_by_role('searchbox',name='Find a water').fill('no such water')
                        expect(directory.get_by_role('heading',name='No water by that name.')).to_be_visible()
                        directory.get_by_role('button',name='Show every place',exact=True).click()
                        expect(directory.locator('.d-directory-list>a')).to_have_count(17)
                        directory.get_by_role('searchbox',name='Find a water').fill('frostbite')
                        directory.get_by_role('link',name='Frostbite Flats',exact=False).click()
                        expect(page.get_by_role('heading',name='Frostbite Flats',exact=True)).to_be_visible()
                        page.get_by_role('button',name='Meet the fish',exact=True).click()
                        page.get_by_role('button',name='Any time',exact=True).click()
                        page.locator('.d-fish-link').filter(has_text='Tiger Muskie').click()
                        expect(page.locator('.d-specimen h1')).to_contain_text('The ice edition.')
                        page.get_by_role('link',name='The fish',exact=True).click()
                        page.get_by_role('searchbox',name='Find a fish',exact=True).fill('Toothy Terror')
                        expect(page.locator('.d-fish-link')).to_have_count(1)
                        page.get_by_role('searchbox',name='Find a fish',exact=True).fill('not a real fish')
                        expect(page.get_by_role('heading',name='No fish by that name.')).to_be_visible()
                        page.get_by_role('button',name='Show all fish',exact=True).click()
                        expect(page.locator('.d-fish-link')).to_have_count(68)
                        page.get_by_role('link',name='The notes',exact=True).click()
                        page.locator('.d-note-index>a').filter(has=page.get_by_role('heading',name='Ice fishing',exact=True)).click()
                        expect(page.locator('.d-reading h1')).to_have_text('Ice fishing')
                        page.get_by_role('link',name='The waters',exact=True).click()
                        for width,height in [(1440,900),(820,700),(390,844),(320,360)]:
                            page.set_viewport_size({'width':width,'height':height})
                            page.get_by_role('button',name='All waters',exact=True).click()
                            box=directory.bounding_box()
                            assert box['x']>=0 and box['y']>=0 and box['x']+box['width']<=width and box['y']+box['height']<=height,(width,height,box)
                            expect(directory.get_by_role('searchbox',name='Find a water')).to_be_focused()
                            search_box=directory.get_by_role('searchbox',name='Find a water').bounding_box()
                            first_place=directory.locator('.d-directory-list>a').first.bounding_box()
                            assert search_box['height']<=65,('Oversized water search',width,height,search_box)
                            assert first_place['y']>=search_box['y']+search_box['height'] and first_place['y']+first_place['height']<=box['y']+box['height'],('First destination hidden',width,height,first_place,box)
                            page.keyboard.press('Shift+Tab')
                            expect(directory.get_by_role('button',name='Close water directory')).to_be_focused()
                            page.keyboard.press('Shift+Tab')
                            expect(directory.locator('.d-directory-list>a').last).to_be_focused()
                            page.keyboard.press('Tab')
                            expect(directory.get_by_role('button',name='Close water directory')).to_be_focused()
                            page.keyboard.press('Escape')
                            expect(directory).not_to_be_visible()
                            expect(page.get_by_role('button',name='All waters',exact=True)).to_be_focused()
                        # Long destination names and every scene must fit under the header.
                        locations=json.loads((ROOT/'public/data/catalog.json').read_text())['locations']
                        for width,height in [(320,740),(640,900),(1440,1000)]:
                            page.set_viewport_size({'width':width,'height':height})
                            for place in locations:
                                visit('/waters/'+place['id'])
                                audit(f'expedition/light/{width}/water-{place["id"]}')
                                title=page.locator('#d-water-title').bounding_box()
                                header=page.locator('.d-header').bounding_box()
                                button=page.locator('.d-discover').bounding_box()
                                footer=page.locator('.d-landscape-footer').bounding_box()
                                assert title['y']>=header['y']+header['height'],('title hidden by header',width,place['name'])
                                assert button['y']+button['height']<=footer['y'],('overlapping landscape controls',width,place['name'])
                    elif design=='sonar':
                        page.get_by_role('searchbox',name='Search species').fill('Toothy Terror')
                        expect(page.locator('.s-records tbody tr')).to_have_count(1)
                        page.locator('.s-record-link').click()
                        expect(page.locator('.s-inspector h2')).to_have_text('Northern Pike')
                        page.get_by_role('searchbox',name='Search species').fill('')
                        page.get_by_label('Fishing spot',exact=True).select_option('lake1-spot2')
                        page.get_by_role('radio',name='Night',exact=True).check()
                        page.get_by_role('checkbox',name='Legends only').check()
                        expect(page.locator('.s-records tbody tr')).to_have_count(1)
                        expect(page.locator('.s-record-link')).to_contain_text('Northern Pike')
                        page.get_by_role('button',name='Reset',exact=True).click()
                        page.keyboard.press('/')
                        expect(page.get_by_role('searchbox',name='Search species')).to_be_focused()
                        page.keyboard.press('ArrowDown')
                        expect(page.locator('.s-record-link').first).to_be_focused()
                        page.set_viewport_size({'width':390,'height':844})
                        visit('/fish')
                        page.get_by_role('button',name='Filters',exact=True).click()
                        page.get_by_label('Fishing spot',exact=True).select_option('lake1-spot2')
                        page.get_by_role('button',name='Close filters',exact=True).click()
                        expect(page.locator('.s-filters')).not_to_be_visible()
                        expect(page.locator('.s-records tbody tr')).to_have_count(5)
                        page.locator('.s-record-link').first.click()
                        expect(page.locator('.s-inspector')).to_be_visible()
                        page.get_by_role('link',name='Back to results',exact=True).click()
                        expect(page.locator('.s-results')).to_be_visible()
                        page.set_viewport_size({'width':1440,'height':1000})
                        page.get_by_role('link',name='Equipment',exact=True).click()
                        page.set_viewport_size({'width':390,'height':844})
                        page.get_by_role('button',name='Filters',exact=True).click()
                        page.get_by_role('radio',name='Boats',exact=True).check()
                        page.get_by_role('button',name='Close filters',exact=True).click()
                        expect(page.get_by_role('button',name='Filters (1)',exact=True)).to_be_visible()
                        page.set_viewport_size({'width':1440,'height':1000})
                        expect(page.locator('.s-records tbody tr')).to_have_count(5)
                        page.get_by_role('link',name='Notes',exact=True).click()
                        page.get_by_role('searchbox',name='Search notes').fill('fighting')
                        page.locator('.s-note-index>a').first.click()
                        expect(page.locator('.s-note-reader>h2')).to_have_text('Fighting fish')
                    else:
                        page.get_by_role('button',name='Mark Bluegill Sunfish as caught',exact=True).click()
                        page.locator('.p-shelf-tabs').get_by_role('button',name='Caught').click()
                        expect(page.locator('.p-stamp')).to_have_count(1)
                        page.get_by_role('link',name='Open Bluegill Sunfish card',exact=True).click()
                        expect(page.locator('.p-fish-dialog')).to_be_visible()
                        expect(page.get_by_role('button',name='Caught! In your book.')).to_have_attribute('aria-pressed','true')
                        page.keyboard.press('Escape')
                        expect(page.locator('.p-fish-dialog')).not_to_be_visible()
                        expect(page.get_by_role('link',name='Open Bluegill Sunfish card',exact=True)).to_be_focused()
                        page.reload();settle()
                        expect(page.get_by_role('button',name='Unmark Bluegill Sunfish as caught',exact=True)).to_have_attribute('aria-pressed','true')
                        page.get_by_role('link',name='Postcards',exact=True).click()
                        page.locator('.p-postcard').filter(has_text='Underwater Meadow').click()
                        expect(page.locator('.p-big-postcard h1')).to_have_text('Underwater Meadow')
                        page.locator('.p-place-back>a').filter(has_text='Northern Pike').click()
                        expect(page.locator('#p-fish-title')).to_have_text('Northern Pike')
                        page.get_by_role('link',name='Next fish card').click()
                        expect(page.locator('#p-fish-title')).not_to_have_text('Northern Pike')
                        page.keyboard.press('Escape')
                        page.get_by_role('link',name='Field notes',exact=True).click()
                        page.get_by_role('searchbox',name='Find a field note').fill('fighting')
                        page.locator('.p-note>summary').first.click()
                        expect(page.locator('.p-note-content').first).to_be_visible()
                    print(f'  {name} main task passed.',flush=True)
                    visit('/home')
                    # Preference UI and persistence at phone width, including a short window.
                    page.set_viewport_size({'width':320,'height':360})
                    page.get_by_role('button',name='Change design, current:').click()
                    panel=page.locator('#design-picker')
                    expect(panel.get_by_role('radio',name=name,exact=True)).to_be_focused()
                    box=panel.bounding_box()
                    assert box['y']>=0 and box['y']+box['height']<=361,(design,box)
                    panel.get_by_role('button',name='Done',exact=True).click()
                    choose_unit(page,'kg')
                    page.reload();settle()
                    expect(page.locator('html')).to_have_attribute('data-design',design)
                    page.set_viewport_size({'width':1440,'height':1000})
                    choose_unit(page,'lb')
            report={'independentInterfaces':list(selected_designs.values()),'headless':True,'screenChecks':checks,'runtimeErrors':issues,'externalRequests':external,'failures':failures}
            report_name = 'tasks-report.json' if tasks_only else 'screenshots-report.json' if screenshots_only else 'report.json'
            (ARTIFACTS/((only_design + '-' if only_design else '') + report_name)).write_text(json.dumps(report,indent=2)+'\n')
            browser.close()
            print(f'Reviewed {checks} screens. {len(failures)} layout/contrast findings; {len(issues)} runtime failures.',flush=True)
            assert not issues,issues
            assert not external,external
            assert not failures, failures[:10]
    finally:
        server.shutdown();server.server_close()
