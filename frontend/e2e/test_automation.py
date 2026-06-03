import re

from playwright.sync_api import expect, sync_playwright

BASE_URL = 'http://localhost:5173'


def test_homepage_welcome_screen(page):
    page.goto(BASE_URL)
    page.wait_for_load_state('networkidle')
    expect(page.locator('.empty-state-title')).to_have_text('虚拟软件外包团队')
    steps = page.locator('.empty-state-desc + div [style*="textAlign"]')
    expect(steps).to_have_count(3)
    expect(steps.nth(0)).to_contain_text('分析需求')
    expect(steps.nth(1)).to_contain_text('分组讨论')
    expect(steps.nth(2)).to_contain_text('产出结果')
    expect(page).to_have_title('虚拟软件外包团队')


def test_sidebar_renders(page):
    page.goto(BASE_URL)
    page.wait_for_load_state('networkidle')
    expect(page.locator('.sidebar-logo')).to_be_visible()
    expect(page.locator('.sidebar-logo')).to_contain_text('AI 外包')
    expect(page.locator('.new-chat-btn')).to_be_visible()
    expect(page.locator('.new-chat-btn')).to_contain_text('新对话')
    expect(page.locator('.settings-btn').first).to_be_visible()


def test_chatinput_typing_and_button_state(page):
    page.goto(BASE_URL)
    page.wait_for_load_state('networkidle')
    textarea = page.locator('.chat-input')
    send_btn = page.locator('.chat-send-btn')
    expect(textarea).to_be_empty()
    expect(send_btn).to_be_disabled()
    textarea.fill('测试需求')
    expect(send_btn).to_be_enabled()
    textarea.fill('')
    expect(send_btn).to_be_disabled()
    textarea.fill('   ')
    expect(send_btn).to_be_disabled()


def test_chatinput_enter_submit(page):
    page.goto(BASE_URL)
    page.wait_for_load_state('networkidle')
    textarea = page.locator('.chat-input')
    textarea.fill('需求描述')
    textarea.press('Enter')
    page.wait_for_timeout(500)
    expect(textarea).to_have_value('')


def test_config_panel_open_close(page):
    page.goto(BASE_URL)
    page.wait_for_load_state('networkidle')
    page.locator('.settings-btn').click()
    page.wait_for_timeout(300)
    config_modal = page.locator('.config-modal')
    expect(config_modal).to_be_visible()
    expect(config_modal).to_contain_text('配置')
    expect(config_modal).to_contain_text('DEEPSEEK_API_KEY')
    config_modal.locator('button:has-text("关闭")').click()
    page.wait_for_timeout(300)
    expect(config_modal).not_to_be_visible()


def test_config_panel_click_overlay_closes(page):
    page.goto(BASE_URL)
    page.wait_for_load_state('networkidle')
    page.locator('.settings-btn').click()
    page.wait_for_timeout(300)
    expect(page.locator('.config-overlay')).to_be_visible()
    page.locator('.config-overlay').click(position={'x': 10, 'y': 10})
    page.wait_for_timeout(300)
    expect(page.locator('.config-modal')).not_to_be_visible()


def test_history_page_navigation(page):
    page.goto(f'{BASE_URL}/history')
    page.wait_for_load_state('networkidle')
    expect(page).to_have_url(re.compile(r'/history'))
    expect(page.locator('h2')).to_contain_text('历史记录')


def test_empty_state_on_history_page(page):
    page.goto(f'{BASE_URL}/history')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(2000)
    expect(page.locator('.empty-state-title')).to_contain_text('暂无记录')


def test_error_banner_when_api_fails(page):
    page.goto(BASE_URL)
    page.wait_for_load_state('networkidle')
    page.locator('.chat-input').fill('测试需求')
    page.locator('.chat-send-btn').click()
    page.wait_for_timeout(12000)
    expect(page.locator('.error-banner')).to_be_visible()


def test_chatinput_placeholder(page):
    page.goto(BASE_URL)
    page.wait_for_load_state('networkidle')
    expect(page.locator('.chat-input')).to_have_attribute(
        'placeholder', '输入需求，三个 AI 角色将展开讨论...'
    )


def test_sidebar_new_chat_button(page):
    page.goto(BASE_URL)
    page.wait_for_load_state('networkidle')
    expect(page.locator('.new-chat-btn')).to_be_enabled()


def test_page_has_correct_structure(page):
    page.goto(BASE_URL)
    page.wait_for_load_state('networkidle')
    expect(page.locator('.app-layout')).to_be_visible()
    expect(page.locator('.sidebar')).to_be_visible()
    expect(page.locator('.main-area')).to_be_visible()


def test_all_pages_render_without_crash(page):
    for route in ['/', '/history', '/history/nonexistent']:
        page.goto(f'{BASE_URL}{route}')
        page.wait_for_load_state('networkidle')
        page.wait_for_timeout(500)
        expect(page.locator('body')).to_be_visible()
        body = page.locator('body').inner_text()
        assert 'Cannot read properties' not in body, f'Crash on route {route}'


def run_all_tests():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1280, 'height': 720}, locale='zh-CN')
        page = context.new_page()

        passed = 0
        failed = 0
        results = []

        tests = [
            ('首页欢迎界面渲染', test_homepage_welcome_screen),
            ('侧边栏关键元素', test_sidebar_renders),
            ('ChatInput 输入和按钮状态', test_chatinput_typing_and_button_state),
            ('Enter 提交消息', test_chatinput_enter_submit),
            ('配置面板打开关闭', test_config_panel_open_close),
            ('遮罩层关闭面板', test_config_panel_click_overlay_closes),
            ('历史记录导航', test_history_page_navigation),
            ('历史记录空状态', test_empty_state_on_history_page),
            ('API 错误提示', test_error_banner_when_api_fails),
            ('输入框占位符', test_chatinput_placeholder),
            ('新对话按钮', test_sidebar_new_chat_button),
            ('页面基本结构', test_page_has_correct_structure),
            ('所有路由不崩溃', test_all_pages_render_without_crash),
        ]

        for name, test_fn in tests:
            try:
                test_fn(page)
                print(f'  [{chr(0x2714)}] {name}')
                results.append(('PASS', name))
                passed += 1
            except Exception as e:
                print(f'  [{chr(0x2718)}] {name}: {type(e).__name__}: {e}')
                results.append(('FAIL', name))
                failed += 1

        browser.close()

        print(f'\n{"="*50}')
        print(f'RESULTS: {passed} passed, {failed} failed, {len(tests)} total')
        print(f'{"="*50}')
        for status, name in results:
            print(f'  [{status}] {name}')

        return failed == 0


if __name__ == '__main__':
    run_all_tests()
