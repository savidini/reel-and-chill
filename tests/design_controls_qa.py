"""Both popovers must stay usable in tall mastheads and short windows."""
from playwright.sync_api import expect
from theme_qa import CONTRAST_AUDIT
from display_qa import open_display, choose_theme


def check_design_controls(page, visit):
    visit('/#/home')
    checks = 0
    for design, name in [('original','Original'), ('journal','Sunday Cast'), ('expedition','Drift'), ('sonar','Sonar'), ('studio','Pocket')]:
        page.set_viewport_size({'width': 1440, 'height': 900})
        page.get_by_role('button', name='Change design, current:').click()
        page.locator('label.design-option').filter(has=page.locator(f'input[value="{design}"]')).click()
        if page.locator('#design-picker').is_visible():
            page.get_by_role('button', name='Done', exact=True).click()
        expect(page.locator('html')).to_have_attribute('data-design', design)
        for appearance in ['light', 'dark']:
            choose_theme(page, appearance)
            for width, height in [(1920, 900), (1440, 900), (1280, 720), (1024, 360), (820, 720), (640, 360), (390, 844), (320, 360)]:
                page.set_viewport_size({'width': width, 'height': height})
                page.evaluate('scrollTo(0, 0)')
                assert page.evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1')
                controls = page.locator('header .header-controls')
                expect(controls).to_have_count(1)
                for trigger in ['.design-trigger', '.display-trigger']:
                    box = controls.locator(trigger).bounding_box()
                    assert box['x'] >= 0 and box['x'] + box['width'] <= width, (design, width, box)
                for kind in ['design', 'display']:
                    if kind == 'design':
                        page.get_by_role('button', name='Change design, current:').click()
                        panel = page.get_by_role('dialog', name='Find your kind of chill.')
                    else:
                        panel = open_display(page)
                    expect(panel).to_be_visible()
                    assert not page.evaluate(CONTRAST_AUDIT)['failures'], (design, appearance, width, kind, page.evaluate(CONTRAST_AUDIT)['failures'])
                    box = panel.bounding_box()
                    assert box['x'] >= 0 and box['y'] >= 0 and box['x'] + box['width'] <= width and box['y'] + box['height'] <= height, (design, kind, width, height, box)
                    if kind == 'design':
                        expect(panel.get_by_role('radio', name=name, exact=True)).to_be_focused()
                        panel.get_by_role('button', name='Done', exact=True).click()
                    else:
                        panel.get_by_text('kg', exact=True).click()
                        expect(panel.get_by_role('radio', name='kg', exact=True)).to_be_checked()
                        panel.get_by_text('lb / oz', exact=True).click()
                        page.keyboard.press('Escape')
                    expect(panel).not_to_be_visible()
                    expect(page.locator('.design-trigger' if kind == 'design' else '.display-trigger')).to_be_focused()
                    checks += 1
        # Popovers dismiss each other; a route change dismisses the design picker.
        page.set_viewport_size({'width': 1440, 'height': 900})
        page.get_by_role('button', name='Change design, current:').click()
        open_display(page)
        expect(page.locator('#design-picker')).not_to_be_visible()
        page.keyboard.press('Escape')
        page.get_by_role('button', name='Change design, current:').click()
        page.evaluate("location.hash = '/fish'")
        expect(page.locator('#design-picker')).not_to_be_visible()
        visit('/#/home')
    # Keep the picker and keyboard focus while replacing an entire interface.
    page.set_viewport_size({'width': 1440, 'height': 900})
    visit('/#/home')
    page.get_by_role('button', name='Change design, current:').click()
    picker = page.locator('#design-picker')
    picker.locator('label.design-option').filter(has=page.locator('input[value="journal"]')).click()
    expect(picker).to_be_visible()
    expect(picker.get_by_role('radio', name='Sunday Cast', exact=True)).to_be_focused()
    for key, design in [('ArrowRight','expedition'), ('ArrowRight','sonar'), ('ArrowRight','studio'), ('ArrowLeft','sonar'), ('ArrowLeft','expedition'), ('ArrowLeft','journal')]:
        page.keyboard.press(key)
        expect(page.locator('html')).to_have_attribute('data-design', design)
        expect(picker).to_be_visible()
        expect(picker.locator(f'input[value="{design}"]')).to_be_focused()
    page.keyboard.press('ArrowLeft')
    expect(page.locator('html')).to_have_attribute('data-design', 'original')
    expect(page.locator('.guide-shell')).to_be_visible()
    expect(picker).to_be_visible()
    expect(picker.get_by_role('radio', name='Original', exact=True)).to_be_focused()
    page.keyboard.press('Escape')
    expect(picker).not_to_be_visible()
    expect(page.get_by_role('button', name='Change design, current:')).to_be_focused()
    print(f'All {checks} design/display panel checks passed, including 360px-tall windows and keyboard interface switching.', flush=True)
    return checks
