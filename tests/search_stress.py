"""Regression: a deferred dialog reset must not erase a repeated search."""
from playwright.sync_api import expect
from display_qa import open_display


def check_search_stress(page, visit):
    visit('/#/sources')
    for index in range(12):
        # Reopen within the same document so the previous query still exists.
        page.set_viewport_size({'width': [1440, 820, 390, 320][index % 4], 'height': 960})
        open_display(page)
        page.keyboard.press('Escape')
        page.get_by_role('button', name='Search guide', exact=True).click()
        search = page.get_by_role('searchbox', name='Search the whole guide', exact=True)
        search.fill('salmon')
        expect(page.locator('.search-results a').first).to_be_visible()
        page.keyboard.press('ArrowDown')
        expect(page.locator('.search-results a').first).to_be_focused()
        # Cross the next paint to catch a pending state reset, then confirm focus.
        page.evaluate('() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
        expect(search).to_have_value('salmon')
        expect(page.locator('.search-results a').first).to_be_focused()
        page.keyboard.press('Escape')
        expect(page.get_by_role('button', name='Search guide', exact=True)).to_be_focused()
    print('Repeated-search regression passed at desktop, tablet and phone widths.', flush=True)
