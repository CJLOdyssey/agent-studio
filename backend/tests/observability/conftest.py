"""observability 测试隔离夹具。

``observability.trace`` 用 contextvars 保存 trace 状态，``set_trace_id`` /
``span`` 会写入当前上下文且不会自动还原——同一 worker 内测试顺序被
xdist worksteal 重排时（如 ``test_span_nested`` 先于
``test_current_trace_id_default``），残留的 trace id 会让"默认值"断言
偶发失败（CI 实测：assert 'nested-trace' == ''）。
每个测试前后重置，保证与执行顺序无关。
"""

import pytest


@pytest.fixture(autouse=True)
def _reset_trace_context():
    from observability.trace import set_trace_id

    set_trace_id("")
    yield
    set_trace_id("")
