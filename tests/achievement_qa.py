"""Achievement discovery, linked guidance and responsive checks in headless Chromium."""
import re
from playwright.sync_api import expect
from display_qa import choose_theme, choose_unit
from theme_qa import CONTRAST_AUDIT


def check_achievements(page, visit, artifacts):
    output = artifacts / 'achievements'
    output.mkdir(exist_ok=True)
    designs = ['original', 'journal', 'expedition', 'sonar', 'studio']
    checks = 0

    def switch_design(design):
        page.get_by_role('button', name='Change design, current:').click()
        picker = page.locator('#design-picker')
        picker.locator('label.design-option').filter(has=page.locator(f'input[value="{design}"]')).click()
        expect(page.locator('html')).to_have_attribute('data-design', design)
        if picker.is_visible():
            picker.get_by_role('button', name='Done', exact=True).click()

    def card(achievement):
        return page.locator(f'[data-achievement="{achievement}"]')

    visit('/#/home')
    for design in designs:
        print(f'Checking achievements in {design}…', flush=True)
        page.set_viewport_size({'width': 1440, 'height': 1000})
        switch_design(design)
        visit('/#/home')
        page.locator('a[href="#/achievements"]').first.click()
        expect(page.locator('main h1')).to_have_text('Achievements')
        expect(page).to_have_title(re.compile('Achievements'))
        expect(page.locator('.achievement-card')).to_have_count(38)
        expect(page.locator('.achievement-source a')).to_have_attribute('href', 'https://steamcommunity.com/sharedfiles/filedetails/?id=3501739394')
        query = page.get_by_role('searchbox', name='Search achievements')
        category = page.get_by_label('Achievement category', exact=True)

        if design == 'sonar':
            page.keyboard.press('/')
            expect(query).to_be_focused()
        query.fill('Always Above')
        expect(page.locator('.achievement-card')).to_have_count(3)
        category.select_option('cabin')
        expect(page.get_by_role('heading', name='No matching achievements')).to_be_visible()
        page.get_by_role('button', name='Show all achievements').click()
        for kind, count in [('legendary', 16), ('cabin', 5), ('general', 17), ('', 38)]:
            category.select_option(kind)
            expect(page.locator('.achievement-card')).to_have_count(count)

        query.fill('White Tip')
        card('walleye-trophy').locator('summary').focus()
        page.keyboard.press('Enter')
        expect(card('walleye-trophy').locator('details')).to_have_attribute('open', '')
        expect(card('walleye-trophy')).to_contain_text('Any time')
        expect(card('walleye-trophy')).to_contain_text('community guide suggests noon')
        choose_unit(page, 'kg')
        expect(card('walleye-trophy').locator('strong')).to_contain_text('kg')
        card('walleye-trophy').get_by_role('link', name='Walleye', exact=True).click()
        expect(page).to_have_url(re.compile('/fish/walleye'))
        expect(page.locator('main') if design != 'studio' else page.locator('.p-fish-dialog')).to_contain_text('Walleye')
        page.go_back()
        expect(query).to_have_value('White Tip')
        expect(page.locator('.achievement-card')).to_have_count(1)
        page.reload()
        expect(query).to_have_value('White Tip')
        expect(page.locator('.achievement-card')).to_have_count(1)
        query.fill('Ice Monster')
        card('tiger-muskie-trophy').locator('summary').click()
        expect(card('tiger-muskie-trophy')).to_contain_text('Night')
        expect(card('tiger-muskie-trophy').locator('a[href="#/fish/ice-tiger-muskie"]')).to_be_visible()
        card('tiger-muskie-trophy').get_by_role('link', name='Frostbite Flats').click()
        expect(page).to_have_url(re.compile('/waters/ice1-spot1'))
        page.go_back()
        query.fill('Fishwatch')
        card('viewer-watched').locator('summary').click()
        card('viewer-watched').get_by_role('link', name='Fish Viewer & trophy wall').click()
        expect(page).to_have_url(re.compile('/handbook/viewer-and-trophy-wall'))
        expect(page.locator('main')).to_contain_text('Fish Viewer & trophy wall')
        page.go_back()
        page.get_by_role('button', name='Reset filters').click()

        # Expanded cards exercise the longest content, with both appearance palettes.
        page.locator('.achievement-help').evaluate_all('(els) => els.forEach(el => el.open = true)')
        for theme in ['light', 'dark']:
            choose_theme(page, theme)
            for width in [1920, 1440, 1024, 820, 640, 390, 320]:
                page.set_viewport_size({'width': width, 'height': 1000 if width > 640 else 844})
                page.evaluate('document.fonts.ready')
                page.evaluate('scrollTo(0,0)')
                assert page.evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1'), (design, theme, width, 'overflow')
                contrast = page.evaluate(CONTRAST_AUDIT)
                assert not contrast['failures'], (design, theme, width, contrast['failures'][:5])
                nav = page.locator('.j-nav a,.d-header nav a,.s-header nav a,.p-tabs>a')
                for link in nav.all():
                    bounds = link.bounding_box()
                    assert bounds and bounds['x'] >= 0 and bounds['x'] + bounds['width'] <= width + 1, (design, width, link.inner_text(), bounds)
                    assert link.evaluate('(el) => { const r=el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)); }'), (design, width, 'obscured navigation', link.inner_text())
                if width in [1440, 390]:
                    page.screenshot(path=str(output / f'{design}-{theme}-{width}.png'))
                checks += 1
        choose_unit(page, 'lb')

    # A search link remains useful while changing interfaces.
    page.set_viewport_size({'width': 1440, 'height': 1000})
    visit('/#/achievements?q=Fishwatch&kind=cabin')
    for design in designs:
        switch_design(design)
        expect(page.get_by_role('searchbox', name='Search achievements')).to_have_value('Fishwatch')
        expect(page.get_by_label('Achievement category')).to_have_value('cabin')
        expect(page.locator('.achievement-card')).to_have_count(1)
        expect(page.locator('.achievement-card h2')).to_have_text('Fishwatch')
    return {'designs': designs, 'layoutChecks': checks, 'guidance': '38 achievements; keyboard disclosure, search, categories, units, related links, Back/reload and design switching'}
