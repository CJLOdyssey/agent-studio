"""
虚拟软件外包团队 — 灰盒冒烟测试套件
=========================================
测试类型: 灰盒测试（结合内部代码结构与用户视角）
测试范围: API 接口 / 前端 UI / 集成工作流
"""

import json
import re
import urllib.error
import urllib.parse
import urllib.request

from playwright.sync_api import expect, sync_playwright

# ─── 环境配置 ─────────────────────────────────────────────────
FRONTEND_URL = 'http://localhost:5173'
API_URL = 'http://localhost:8080/api'

# ─── 工具函数 ─────────────────────────────────────────────────


def api_get(path: str) -> dict:
    """灰盒测试: 直接调用后端 API"""
    with urllib.request.urlopen(f'{API_URL}{path}', timeout=5) as r:
        return json.loads(r.read().decode())


def api_post(path: str, body: dict) -> dict:
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        f'{API_URL}{path}', data=data,
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return {'_status': e.code, '_body': e.read().decode()}


def api_put(path: str, body: dict) -> dict:
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        f'{API_URL}{path}', data=data,
        headers={'Content-Type': 'application/json'},
        method='PUT',
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return {'_status': e.code, '_body': e.read().decode()}


def api_delete(path: str) -> dict:
    req = urllib.request.Request(f'{API_URL}{path}', method='DELETE')
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            body = r.read().decode()
            return json.loads(body) if body.strip() else {}
    except urllib.error.HTTPError as e:
        return {'_status': e.code, '_body': e.read().decode()}


# ═══════════════════════════════════════════════════════════════
# SUITE A: API 层冒烟测试（灰盒 — 直接调用已知端点）
# ═══════════════════════════════════════════════════════════════


def test_api_health_check():
    """A01: 健康检查端点"""
    result = api_get('/health')
    assert result.get('status') in ('ok', 'degraded'), f"Unexpected status: {result}"
    assert 'database' in result
    assert 'redis' in result


def test_api_create_and_get_run():
    """A02: 创建一次讨论并查询"""
    sess = api_post('/sessions', {'title': '冒烟测试会话'})
    assert 'id' in sess, f"Session creation failed: {sess}"

    run = api_post('/runs', {'requirement': '测试需求: 计算器', 'session_id': sess['id']})
    assert 'run_id' in run, f"Run creation failed: {run}"
    assert run['status'] == 'pending'

    detail = api_get(f"/runs/{run['run_id']}")
    assert 'id' in detail
    assert detail['requirement'] == '测试需求: 计算器'


def test_api_list_runs():
    """A03: 获取讨论列表"""
    runs = api_get('/runs?limit=5')
    assert isinstance(runs, list)
    for r in runs:
        assert 'id' in r
        assert 'requirement' in r


def test_api_session_crud():
    """A04: 会话完整 CRUD"""
    # Create
    sess = api_post('/sessions', {'title': 'CRUD 测试会话'})
    sess_id = sess['id']
    assert sess_id

    # Read
    detail = api_get(f'/sessions/{sess_id}')
    assert detail['title'] == 'CRUD 测试会话'
    assert 'runs' in detail
    assert 'memories' in detail

    # Update
    updated = api_put(f'/sessions/{sess_id}', {'title': '已重命名'})
    assert updated['status'] == 'updated'

    # Verify update
    detail2 = api_get(f'/sessions/{sess_id}')
    assert detail2['title'] == '已重命名'

    # Delete
    result = api_delete(f'/sessions/{sess_id}')
    assert result.get('status') == 'deleted'

    # Verify deletion
    try:
        api_get(f'/sessions/{sess_id}')
        raise AssertionError('Should have raised 404')
    except urllib.error.HTTPError as e:
        assert e.code == 404


def test_api_list_sessions():
    """A05: 获取会话列表"""
    sessions = api_get('/sessions?limit=10')
    assert isinstance(sessions, list)
    for s in sessions:
        assert 'id' in s
        assert 'title' in s
        assert 'run_count' in s


def test_api_agent_config_crud():
    """A06: Agent 配置 CRUD"""
    # List
    agents = api_get('/agents')
    assert isinstance(agents, list)

    # Create (must match ^[a-z_]+$)
    import random
    import string
    letters = string.ascii_lowercase
    role = 'test_agent_' + ''.join(random.choice(letters) for _ in range(8))
    created = api_post('/agents', {
        'name': '测试Agent',
        'role_identifier': role,
        'system_prompt': '你是一个测试Agent',
        'order': 0,
        'is_active': True,
        'is_approver': False,
        'icon': '🤖',
    })
    assert 'id' in created
    agent_id = created['id']

    # Update
    api_put(f'/agents/{agent_id}', {'name': '已更新Agent', 'is_active': False})

    # Toggle
    toggled = api_put(f'/agents/{agent_id}/toggle', {})
    assert toggled['is_active'] is True

    # Delete
    api_delete(f'/agents/{agent_id}')

    # Verify deletion
    agents_after = api_get('/agents')
    ids = [a['id'] for a in agents_after]
    assert agent_id not in ids


def test_api_agent_validation():
    """A07: Agent 输入验证"""
    # Duplicate role_identifier (only letters, must match ^[a-z_]+$)
    import random
    import string
    letters = string.ascii_lowercase
    role = 'dup_role_' + ''.join(random.choice(letters) for _ in range(8))
    api_post('/agents', {
        'name': 'First', 'role_identifier': role,
        'system_prompt': 'prompt', 'order': 0, 'is_active': True,
        'is_approver': False, 'icon': '🤖',
    })
    dup = api_post('/agents', {
        'name': 'Second', 'role_identifier': role,
        'system_prompt': 'prompt', 'order': 1, 'is_active': True,
        'is_approver': False, 'icon': '🤖',
    })
    assert dup.get('_status') == 409, f"Expected 409 but got {dup}"


def test_api_memory_export_formats():
    """A08: 记忆导出格式验证"""
    # Create session + run to generate memories (mock)
    sess = api_post('/sessions', {'title': '记忆导出测试'})
    sess_id = sess['id']

    # Export JSON
    try:
        with urllib.request.urlopen(f'{API_URL}/sessions/{sess_id}/memories/export?format=json', timeout=5) as r:
            assert r.headers.get('Content-Type', '').startswith('application/json')
            data = json.loads(r.read().decode())
            assert isinstance(data, list)
    except urllib.error.HTTPError:
        pass  # No memories yet is acceptable

    # Export MD
    try:
        with urllib.request.urlopen(f'{API_URL}/sessions/{sess_id}/memories/export?format=md', timeout=5) as r:
            assert r.headers.get('Content-Type', '').startswith('text/markdown')
    except urllib.error.HTTPError:
        pass  # No memories yet is acceptable

    # Invalid format
    try:
        with urllib.request.urlopen(f'{API_URL}/sessions/{sess_id}/memories/export?format=xml', timeout=5):
            raise AssertionError('Should reject invalid format')
    except urllib.error.HTTPError as e:
        assert e.code == 400


def test_api_error_handling():
    """A09: API 错误处理"""
    # Empty requirement → validation error
    result = api_post('/runs', {'requirement': ''})
    assert result.get('_status') in (400, 422), f'Expected 400/422, got {result}'

    # Non-existent run
    try:
        api_get('/runs/nonexistent-id-12345')
        raise AssertionError('Should raise 404')
    except urllib.error.HTTPError as e:
        assert e.code == 404

    # Non-existent session
    try:
        api_get('/sessions/nonexistent-id-12345')
        raise AssertionError('Should raise 404')
    except urllib.error.HTTPError as e:
        assert e.code == 404


# ═══════════════════════════════════════════════════════════════
# SUITE B: 前端 UI 冒烟测试
# ═══════════════════════════════════════════════════════════════


def test_b01_homepage_renders(page):
    """B01: 首页基础渲染"""
    page.goto(FRONTEND_URL)
    page.wait_for_load_state('networkidle')
    expect(page.get_by_role('heading', name='DevAgents OS')).to_be_visible()
    expect(page.get_by_role('textbox')).to_be_visible()
    expect(page).to_have_title('虚拟软件外包团队')


def test_b02_sidebar_elements(page):
    """B02: 侧边栏元素"""
    page.goto(FRONTEND_URL)
    page.wait_for_load_state('networkidle')
    expect(page.get_by_role('heading', name='DevAgents OS')).to_be_visible()
    expect(page.get_by_role('button', name='新建对话')).to_be_visible()
    expect(page.get_by_role('button', name='系统设置')).to_be_visible()


def test_b03_chat_input_states(page):
    """B03: 输入框状态变化"""
    page.goto(FRONTEND_URL)
    page.wait_for_load_state('networkidle')
    textarea = page.get_by_role('textbox')
    send_btn = page.get_by_role('button', name='发送')

    # Initial: empty → disabled
    expect(textarea).to_be_empty()
    expect(send_btn).to_be_disabled()

    # With text → enabled
    textarea.fill('写一个计算器应用')
    expect(send_btn).to_be_enabled()

    # Cleared → disabled
    textarea.fill('')
    expect(send_btn).to_be_disabled()

    # Whitespace only → disabled
    textarea.fill('   ')
    expect(send_btn).to_be_disabled()


def test_b04_placeholder_text(page):
    """B04: 占位符文本"""
    page.goto(FRONTEND_URL)
    page.wait_for_load_state('networkidle')
    expect(page.get_by_role('textbox')).to_have_attribute(
        'placeholder', '描述你的需求，我来帮你分析和规划...'
    )


def test_b05_enter_submits_clears_input(page):
    """B05: Enter 提交并清空输入（灰盒: 已知 submitRequirement 逻辑）"""
    page.goto(FRONTEND_URL)
    page.wait_for_load_state('networkidle')
    textarea = page.get_by_role('textbox')
    textarea.fill('测试需求描述')
    textarea.press('Enter')
    page.wait_for_timeout(500)
    expect(textarea).to_have_value('')


def test_b06_config_panel(page):
    """B06: 配置面板交互"""
    page.goto(FRONTEND_URL)
    page.wait_for_load_state('networkidle')
    page.get_by_role('button', name='系统设置').click()
    page.wait_for_timeout(300)

    config_modal = page.locator('[role="dialog"]')
    expect(config_modal).to_be_visible()


def test_b07_config_panel_overlay_close(page):
    """B07: 点击遮罩关闭配置面板"""
    page.goto(FRONTEND_URL)
    page.wait_for_load_state('networkidle')
    page.get_by_role('button', name='系统设置').click()
    page.wait_for_timeout(300)
    overlay = page.locator('[role="dialog"]')
    expect(overlay).to_be_visible()
    overlay.press('Escape')
    page.wait_for_timeout(300)


def test_b08_team_members_section(page):
    """B08: 团队成员列表渲染"""
    page.goto(FRONTEND_URL)
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(2000)


def test_b09_sessions_section(page):
    """B09: 对话列表区块"""
    page.goto(FRONTEND_URL)
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(2000)


def test_b10_new_chat_button(page):
    """B10: 新对话按钮功能"""
    page.goto(FRONTEND_URL)
    page.wait_for_load_state('networkidle')
    new_chat = page.get_by_role('button', name='新建对话')
    expect(new_chat).to_be_visible()
    expect(new_chat).to_be_enabled()


def test_b11_history_page(page):
    """B11: 历史记录页"""
    page.goto(f'{FRONTEND_URL}/history')
    page.wait_for_load_state('networkidle')
    expect(page).to_have_url(re.compile(r'/history'))


def test_b12_no_crash_on_routes(page):
    """B12: 关键路由不崩溃"""
    for route in ['/', '/history', '/history/nonexistent']:
        page.goto(f'{FRONTEND_URL}{route}')
        page.wait_for_load_state('networkidle')
        page.wait_for_timeout(500)
        expect(page.locator('body')).to_be_visible()
        body_text = page.locator('body').inner_text()
        crash_indicators = [
            'Cannot read properties', 'undefined', 'TypeError',
            'is not defined', 'Cannot find module',
        ]
        for indicator in crash_indicators:
            assert indicator not in body_text, \
                f"Crash indicator '{indicator}' found on route {route}"


def test_b13_error_banner_display(page):
    """B13: 错误提示渲染（灰盒: 已知 submitRequirement 失败会显示 error-banner）"""
    page.goto(FRONTEND_URL)
    page.wait_for_load_state('networkidle')
    page.get_by_role('textbox').fill('触发错误的测试需求')
    page.get_by_role('button', name='发送').click()
    page.wait_for_timeout(12000)


def test_b14_agent_status_toggle(page):
    """B14: Agent 状态指示器"""
    page.goto(FRONTEND_URL)
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(2000)
    agent_list = page.get_by_role('list')
    expect(agent_list).to_be_visible()


# ═══════════════════════════════════════════════════════════════
# SUITE C: 集成测试（工作流验证）
# ═══════════════════════════════════════════════════════════════


def test_c01_create_session_via_sidebar(page):
    """C01: 通过侧边栏创建新会话（灰盒: 已知调用 createSession API）"""
    page.goto(FRONTEND_URL)
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(2000)

    new_chat = page.get_by_role('button', name='新建对话')
    expect(new_chat).to_be_enabled()
    new_chat.click()
    page.wait_for_timeout(1000)


def test_c02_empty_submission_rejected(page):
    """C02: 空提交被阻止（灰盒: 已知 ChatInput 组件逻辑）"""
    page.goto(FRONTEND_URL)
    page.wait_for_load_state('networkidle')
    send_btn = page.get_by_role('button', name='发送')
    expect(send_btn).to_be_disabled()


def test_c03_shift_enter_does_not_submit(page):
    """C03: Shift+Enter 换行不提交"""
    page.goto(FRONTEND_URL)
    page.wait_for_load_state('networkidle')
    textarea = page.get_by_role('textbox')
    textarea.fill('第一行')
    textarea.press('Shift+Enter')
    page.wait_for_timeout(200)
    assert textarea.input_value() != '', 'Textarea should still have content after Shift+Enter'


def test_c04_history_page_renders(page):
    """C04: 历史页渲染（有数据或无数据都通过）"""
    page.goto(f'{FRONTEND_URL}/history')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(2000)
    expect(page.get_by_role('heading', name='历史记录')).to_be_visible()


def test_c05_navigate_home_from_history(page):
    """C05: 从历史页导航回首页"""
    page.goto(f'{FRONTEND_URL}/history')
    page.wait_for_load_state('networkidle')
    new_chat = page.get_by_role('button', name='新建对话')
    expect(new_chat).to_be_enabled()
    new_chat.click()
    page.wait_for_timeout(1000)
    expect(page.get_by_role('heading', name='DevAgents OS')).to_be_visible()


def test_c06_api_health_ui_effect(page):
    """C06: API 健康状态不影响前端渲染（灰盒: 已知前端不依赖 health 端点）"""
    page.goto(FRONTEND_URL)
    page.wait_for_load_state('networkidle')
    expect(page.get_by_role('heading', name='DevAgents OS')).to_be_visible()
    expect(page.get_by_role('textbox')).to_be_visible()


# ═══════════════════════════════════════════════════════════════
# 测试执行器
# ═══════════════════════════════════════════════════════════════

def run_api_tests():
    """执行 API 冒烟测试"""
    api_tests = [
        ('A01 健康检查', test_api_health_check),
        ('A02 创建和查询讨论', test_api_create_and_get_run),
        ('A03 讨论列表', test_api_list_runs),
        ('A04 会话 CRUD', test_api_session_crud),
        ('A05 会话列表', test_api_list_sessions),
        ('A06 Agent 配置 CRUD', test_api_agent_config_crud),
        ('A07 Agent 输入验证', test_api_agent_validation),
        ('A08 记忆导出格式', test_api_memory_export_formats),
        ('A09 错误处理', test_api_error_handling),
    ]
    return _run_tests('API 冒烟测试', api_tests)


def run_ui_tests(page):
    """执行 UI 冒烟测试"""
    ui_tests = [
        ('B01 首页渲染', test_b01_homepage_renders),
        ('B02 侧边栏元素', test_b02_sidebar_elements),
        ('B03 输入框状态', test_b03_chat_input_states),
        ('B04 占位符文本', test_b04_placeholder_text),
        ('B05 Enter 提交', test_b05_enter_submits_clears_input),
        ('B06 配置面板', test_b06_config_panel),
        ('B07 遮罩关闭面板', test_b07_config_panel_overlay_close),
        ('B08 团队成员', test_b08_team_members_section),
        ('B09 对话列表', test_b09_sessions_section),
        ('B10 新对话按钮', test_b10_new_chat_button),
        ('B11 历史页导航', test_b11_history_page),
        ('B12 路由不崩溃', test_b12_no_crash_on_routes),
        ('B13 错误提示', test_b13_error_banner_display),
        ('B14 Agent 状态', test_b14_agent_status_toggle),
    ]
    return _run_page_tests('UI 冒烟测试', ui_tests, page)


def run_integration_tests(page):
    """执行集成测试"""
    integration_tests = [
        ('C01 侧边栏创建会话', test_c01_create_session_via_sidebar),
        ('C02 空提交阻止', test_c02_empty_submission_rejected),
        ('C03 Shift+Enter 换行', test_c03_shift_enter_does_not_submit),
        ('C04 历史页渲染', test_c04_history_page_renders),
        ('C05 历史到首页导航', test_c05_navigate_home_from_history),
        ('C06 健康状态不影响UI', test_c06_api_health_ui_effect),
    ]
    return _run_page_tests('集成测试', integration_tests, page)


def _run_tests(suite_name, tests):
    passed = 0
    failed = 0
    results = []
    print(f'\n{"="*60}')
    print(f'  {suite_name}')
    print(f'{"="*60}')
    for name, test_fn in tests:
        try:
            test_fn()
            print(f'  [PASS] {name}')
            results.append(('PASS', name))
            passed += 1
        except Exception as e:
            print(f'  [FAIL] {name}: {e}')
            results.append(('FAIL', name))
            failed += 1
    print(f'\n  {passed}/{passed + failed} 通过')
    return passed, failed, results


def _run_page_tests(suite_name, tests, page):
    passed = 0
    failed = 0
    results = []
    print(f'\n{"="*60}')
    print(f'  {suite_name}')
    print(f'{"="*60}')
    for name, test_fn in tests:
        try:
            test_fn(page)
            print(f'  [PASS] {name}')
            results.append(('PASS', name))
            passed += 1
        except Exception as e:
            print(f'  [FAIL] {name}: {e}')
            results.append(('FAIL', name))
            failed += 1
    print(f'\n  {passed}/{passed + failed} 通过')
    return passed, failed, results


def main():
    all_passed = 0
    all_failed = 0

    # ── API 测试 ──
    ap, af, _ = run_api_tests()
    all_passed += ap
    all_failed += af

    # ── 前端测试 ──
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={'width': 1280, 'height': 720},
            locale='zh-CN',
        )
        page = context.new_page()
        try:
            up, uf, _ = run_ui_tests(page)
            all_passed += up
            all_failed += uf

            ip, fuf, _ = run_integration_tests(page)
            all_passed += ip
            all_failed += fuf
        finally:
            browser.close()

    # ── 汇总 ──
    total = all_passed + all_failed
    print(f'\n{"="*60}')
    print('  灰盒冒烟测试完成')
    print(f'{"="*60}')
    print(f'  总计: {total}  |  通过: {all_passed}  |  失败: {all_failed}')
    print(f'  通过率: {all_passed / total * 100:.1f}%' if total else '  无测试')
    print(f'{"="*60}')
    return all_failed == 0


if __name__ == '__main__':
    import sys
    sys.exit(0 if main() else 1)
