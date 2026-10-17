"""Appearance, persistence, and rendered text contrast checks in isolated Chromium."""
from playwright.sync_api import expect
from display_qa import choose_theme, open_display


CONTRAST_AUDIT = r'''() => {
    const rgb = value => (value.match(/[\d.]+/g) || []).map(Number);
    const blend = (front, back) => {
        const alpha = front[3] ?? 1;
        return front.slice(0, 3).map((channel, i) => channel * alpha + back[i] * (1 - alpha));
    };
    const luminance = color => color.slice(0, 3).map(c => {
        const s = c / 255;
        return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4;
    }).reduce((sum, channel, i) => sum + channel * [.2126, .7152, .0722][i], 0);
    const failures = [];
    let checked = 0;
    for (const element of document.querySelectorAll('body *')) {
        if (element.closest('.sr-only, [aria-hidden="true"]') ||
            ['SCRIPT', 'STYLE', 'OPTION', 'CANVAS'].includes(element.tagName)) continue;
        const hasText = [...element.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
        if (!hasText && !element.matches('input, select')) continue;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        if (!rect.width || !rect.height || rect.bottom < 0 || style.visibility === 'hidden') continue;
        const ancestors = [];
        for (let parent = element; parent; parent = parent.parentElement) ancestors.unshift(parent);
        const background = ancestors.reduce((color, parent) => blend(rgb(getComputedStyle(parent).backgroundColor), color), [255,255,255]);
        const foreground = blend(rgb(style.color), background);
        const a = luminance(foreground), b = luminance(background);
        const contrast = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
        const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700);
        checked++;
        if (contrast + .01 < (large ? 3 : 4.5)) failures.push({
            element: element.tagName.toLowerCase() + '.' + element.className,
            text: (element.textContent || element.getAttribute('aria-label') || '').trim().slice(0, 80),
            contrast: Number(contrast.toFixed(2)), foreground, background
        });
    }
    return {checked, failures};
}'''


def check_themes(page, context, base, artifacts, visit, no_overflow):
    print('Checking light/dark themes, persistence, system changes, and text contrast…', flush=True)
    page.set_viewport_size({'width': 1440, 'height': 1080})
    page.emulate_media(color_scheme='light')
    visit('/#/home')
    theme = page.locator('input[name="appearance"]:checked')
    expect(theme).to_have_value('system')
    expect(page.locator('html')).to_have_attribute('data-theme', 'light')

    # System follows live OS changes; a manual preference overrides them.
    page.emulate_media(color_scheme='dark')
    expect(page.locator('html')).to_have_attribute('data-theme', 'dark')
    choose_theme(page, 'light')
    expect(page.locator('html')).to_have_attribute('data-theme', 'light')
    page.reload()
    expect(theme).to_have_value('light')
    expect(page.locator('html')).to_have_attribute('data-theme', 'light')
    choose_theme(page, 'dark')
    page.emulate_media(color_scheme='light')
    expect(page.locator('html')).to_have_attribute('data-theme', 'dark')
    visit('/#/fish/northern-pike')
    expect(theme).to_have_value('dark')
    expect(page.locator('html')).to_have_attribute('data-theme', 'dark')
    choose_theme(page, 'system')
    expect(page.locator('html')).to_have_attribute('data-theme', 'light')
    page.emulate_media(color_scheme='dark')
    expect(page.locator('html')).to_have_attribute('data-theme', 'dark')

    # An existing second tab follows saved preference changes and removal.
    second = context.new_page()
    second.goto(base)
    other_theme = second.locator('input[name="appearance"]:checked')
    expect(other_theme).to_have_value('system')
    choose_theme(page, 'dark')
    expect(other_theme).to_have_value('dark')
    expect(second.locator('html')).to_have_attribute('data-theme', 'dark')
    second.evaluate("localStorage.removeItem('cast-guide-theme')")
    expect(theme).to_have_value('system')
    second.close()

    # The HTML bootstrap must honor saved choices before React can execute.
    bootstrap = context.new_page()
    bootstrap.route('**/assets/*', lambda route: route.abort())
    for preference, system, expected in [('dark', 'light', 'dark'), ('light', 'dark', 'light'), ('system', 'dark', 'dark'), ('invalid', 'light', 'light')]:
        page.evaluate('(value) => localStorage.setItem("cast-guide-theme", value)', preference)
        bootstrap.emulate_media(color_scheme=system)
        bootstrap.goto(base)
        expect(bootstrap.locator('html')).to_have_attribute('data-theme', expected)
        assert bootstrap.locator('#root').inner_text() == '', 'React was not held for the first-paint check'
        assert bootstrap.locator('html').evaluate('(el) => getComputedStyle(el).colorScheme') == expected
        expected_background = 'rgb(25, 35, 33)' if expected == 'dark' else 'rgb(245, 242, 235)'
        assert bootstrap.locator('html').evaluate('(el) => getComputedStyle(el).backgroundColor') == expected_background
    bootstrap.close()

    # Privacy/storage restrictions should never prevent using the appearance control.
    restricted = context.new_page()
    restricted.add_init_script('''Object.defineProperty(window, 'localStorage', {
        get() { throw new DOMException('Storage disabled', 'SecurityError'); }
    });''')
    restricted.emulate_media(color_scheme='dark')
    restricted.goto(base)
    restricted_theme = restricted.locator('input[name="appearance"]:checked')
    expect(restricted_theme).to_have_value('system')
    expect(restricted.locator('html')).to_have_attribute('data-theme', 'dark')
    choose_theme(restricted, 'light')
    expect(restricted.locator('html')).to_have_attribute('data-theme', 'light')
    restricted.close()

    layouts = {
        'welcome': '/home', 'atlas': '/fish', 'fish-detail': '/fish/northern-pike',
        'legends': '/legends', 'waters': '/waters', 'water-detail': '/waters/lake1-spot2',
        'tackle': '/tackle', 'tackle-detail': '/tackle/rod10', 'fieldcraft': '/handbook',
        'article': '/handbook/cabin-restoration', 'cabin': '/cabin',
        'achievements': '/achievements', 'wardrobe': '/wardrobe', 'sources': '/sources',
    }
    text_checks = 0

    def check_contrast():
        nonlocal text_checks
        result = page.evaluate(CONTRAST_AUDIT)
        assert not result['failures'], f'{page.url}: {result["failures"][:10]}'
        text_checks += result['checked']

    for appearance in ['light', 'dark']:
        choose_theme(page, appearance)
        for width in [1440, 820, 640, 390, 320]:
            page.set_viewport_size({'width': width, 'height': 960})
            for name, path in layouts.items():
                visit('/#' + path)
                no_overflow()
                expect(page.locator('html')).to_have_attribute('data-theme', appearance)
                # DOM text colors are measured on actual inherited surfaces, including below the fold.
                check_contrast()
                if width in [1440, 390] and name in ['welcome', 'atlas', 'fish-detail', 'tackle', 'tackle-detail', 'article', 'wardrobe']:
                    page.screenshot(path=str(artifacts / f'{name}-{appearance}-{width}.png'), full_page=name == 'welcome')
                if name == 'atlas':
                    families = page.locator('.fish-card h3, .filter-label, .fish-location').evaluate_all('(elements) => [...new Set(elements.map(e => getComputedStyle(e).fontFamily))]')
                    assert len(families) == 1 and 'FieldSans' in families[0], families
                    page.get_by_role('button', name='Show fish as list', exact=True).click()
                    expect(page.locator('.fish-list .fish-card')).to_have_count(68)
                    no_overflow()
                    check_contrast()
                    if width in [1440, 390]:
                        page.screenshot(path=str(artifacts / f'atlas-list-{appearance}-{width}.png'))
                    page.get_by_role('button', name='Show fish as cards', exact=True).click()
            # The open chooser must fit the viewport and use the guide's palette.
            panel = open_display(page)
            check_contrast()
            box = panel.bounding_box()
            assert box['x'] >= 0 and box['x'] + box['width'] <= width, f'{width}px: display panel outside viewport: {box}'
            if width in [1440, 390]:
                page.screenshot(path=str(artifacts / f'display-{appearance}-{width}.png'))
                panel.screenshot(path=str(artifacts / f'display-panel-{appearance}-{width}.png'))
            page.keyboard.press('Escape')
            expect(panel).not_to_be_visible()
            expect(page.get_by_role('button', name='Display settings', exact=True)).to_be_focused()

            # Dialogs inherit the selected palette and retain keyboard focus visibility.
            page.get_by_role('button', name='Search guide', exact=True).click()
            search = page.get_by_role('searchbox', name='Search the whole guide', exact=True)
            search.fill('salmon')
            expect(search).to_have_value('salmon')
            expect(page.locator('.search-results a').first).to_be_visible()
            page.keyboard.press('ArrowDown')
            expect(page.locator('.search-results a').first).to_be_focused()
            check_contrast()
            if width in [1440, 390]:
                page.screenshot(path=str(artifacts / f'search-{appearance}-{width}.png'))
            page.keyboard.press('Escape')
            if width == 390:
                page.get_by_role('button', name='Open chapter index', exact=True).click()
                check_contrast()
                page.screenshot(path=str(artifacts / f'navigation-{appearance}-390.png'))
                page.keyboard.press('Escape')

    # Keyboard-only theme selection also fits on the narrowest supported screen.
    panel = open_display(page)
    panel.get_by_role('radio', name='Dark', exact=True).focus()
    page.keyboard.press('ArrowRight')
    expect(theme).to_have_value('system')
    page.keyboard.press('ArrowRight')
    expect(theme).to_have_value('light')
    expect(page.locator('html')).to_have_attribute('data-theme', 'light')
    no_overflow()
    page.keyboard.press('Escape')
    expect(page.get_by_role('button', name='Display settings', exact=True)).to_be_focused()
    # Light dismissal and tabbing out keep the nonmodal panel out of the way.
    panel = open_display(page)
    page.mouse.click(8, 800)
    expect(panel).not_to_be_visible()
    panel = open_display(page)
    expect(panel.get_by_role('radio', name='Light', exact=True)).to_be_focused()
    page.keyboard.press('Tab')
    expect(panel.get_by_role('radio', name='lb / oz', exact=True)).to_be_focused()
    page.keyboard.press('Tab')
    expect(panel).not_to_be_visible()
    # A short window must leave all controls reachable through panel scrolling.
    page.set_viewport_size({'width': 390, 'height': 360})
    panel = open_display(page)
    panel.get_by_text('kg', exact=True).click()
    expect(panel.get_by_role('radio', name='kg', exact=True)).to_be_checked()
    box = panel.bounding_box()
    assert box['y'] + box['height'] <= 360
    panel.get_by_text('lb / oz', exact=True).click()
    page.keyboard.press('Escape')
    choose_theme(page, 'system')
    page.emulate_media(color_scheme='light')
    page.set_viewport_size({'width': 1440, 'height': 900})
    report = {'modes': ['light', 'dark', 'system'], 'viewports': [1440, 820, 640, 390, 320],
              'layoutChecks': len(layouts) * 5 * 2, 'renderedTextContrastChecks': text_checks,
              'fishListLayoutChecks': 10,
              'checks': ['saved preference', 'system changes', 'cross-tab sync', 'first paint', 'blocked storage', 'keyboard selection', 'font consistency', 'fish list layout']}
    print(f'Appearance checks passed: {report["layoutChecks"]} layouts, {text_checks} rendered text contrast checks.', flush=True)
    return report
