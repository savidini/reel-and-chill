"""Interact with the same display controls used by mouse and keyboard users."""
from playwright.sync_api import expect


def open_display(page):
    panel = page.get_by_role('dialog', name='Display', exact=True)
    if not panel.is_visible():
        page.get_by_role('button', name='Display settings', exact=True).click()
    expect(panel).to_be_visible()
    return panel


def choose_theme(page, value):
    panel = open_display(page)
    panel.get_by_text(value.title(), exact=True).click()
    expect(panel.get_by_role('radio', name=value.title(), exact=True)).to_be_checked()
    page.keyboard.press('Escape')


def choose_unit(page, value):
    panel = open_display(page)
    label = 'kg' if value == 'kg' else 'lb / oz'
    panel.get_by_text(label, exact=True).click()
    expect(panel.get_by_role('radio', name=label, exact=True)).to_be_checked()
    page.keyboard.press('Escape')
