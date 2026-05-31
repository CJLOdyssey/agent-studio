"""Streamlit 前端 - 虚拟软件外包团队

输入需求，AI 团队（产品经理 + 资深程序员 + 测试工程师）
自动讨论并交付：需求文档、代码、审查意见。
"""

import sys
import time
from pathlib import Path

_HERE = Path(__file__).parent
sys.path.insert(0, str(_HERE))

import streamlit as st

from virtual_team.config import load_config, TeamConfig
from virtual_team.conversation import TeamManager
from virtual_team.models import Role

st.set_page_config(
    page_title="虚拟软件外包团队",
    page_icon="🏢",
    layout="wide",
    initial_sidebar_state="expanded",
)

_ROLE_COLORS: dict[Role, str] = {
    Role.PM: "#4A90D9",
    Role.PROGRAMMER: "#00C853",
    Role.TESTER: "#FF6D00",
}
_ROLE_ICONS: dict[Role, str] = {
    Role.PM: "📋",
    Role.PROGRAMMER: "💻",
    Role.TESTER: "🧪",
}
_ROLE_LABELS: dict[Role, str] = {
    Role.PM: "产品经理",
    Role.PROGRAMMER: "资深程序员",
    Role.TESTER: "测试工程师",
}

st.markdown(
    f"""
<style>
    .stApp {{
        background: #0e1117;
    }}
    .main .block-container {{
        padding-top: 1.5rem;
        max-width: 1100px;
    }}

    .team-header {{
        text-align: center;
        padding: 1.8rem 0 1.2rem 0;
        border-bottom: 1px solid #252830;
        margin-bottom: 2rem;
    }}
    .team-header h1 {{
        font-size: 2.2rem;
        font-weight: 700;
        background: linear-gradient(135deg, #e2e8f0 0%, #94a3b8 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        margin-bottom: 0.3rem;
        letter-spacing: 0.5px;
    }}
    .team-header p {{
        color: #64748b;
        font-size: 0.95rem;
    }}
    .team-header .accent {{
        color: #e94560;
        -webkit-text-fill-color: #e94560;
    }}

    .pipeline {{
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 0;
        margin: 1.5rem 0 1.8rem 0;
        flex-wrap: nowrap;
    }}
    .agent-card {{
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 0.75rem 1.2rem;
        border-radius: 12px;
        background: #1a1d27;
        border: 2px solid #252830;
        transition: all 0.4s ease;
        min-width: 120px;
    }}
    .agent-card .icon {{ font-size: 2rem; }}
    .agent-card .name {{
        font-size: 0.85rem;
        font-weight: 600;
        margin-top: 4px;
        color: #94a3b8;
    }}
    .agent-card.active {{
        border-color: var(--accent);
        box-shadow: 0 0 20px color-mix(in srgb, var(--accent) 25%, transparent);
        background: #222638;
    }}
    .agent-card.active .name {{ color: var(--accent); }}
    .agent-card.done {{
        border-color: var(--accent);
        opacity: 0.8;
    }}
    .agent-card.done .name {{ color: var(--accent); }}
    .pipeline-arrow {{
        color: #374151;
        font-size: 1.3rem;
        padding: 0 4px;
    }}

    .status-badge {{
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 14px;
        border-radius: 20px;
        font-size: 0.8rem;
        font-weight: 600;
    }}
    .status-badge.idle {{ background: #252830; color: #64748b; }}
    .status-badge.running {{ background: #1e3a5f; color: #60a5fa; }}
    .status-badge.approved {{ background: #14532d; color: #4ade80; }}
    .status-badge.rejected {{ background: #7f1d1d; color: #fca5a5; }}
    .status-badge.error {{ background: #7f1d1d; color: #fca5a5; }}

    .result-block {{
        background: #1a1d27;
        border: 1px solid #252830;
        border-radius: 12px;
        padding: 1.2rem 1.5rem;
        margin-bottom: 1rem;
    }}
    .result-block h3 {{
        font-size: 1rem;
        font-weight: 600;
        color: #e2e8f0;
        margin-bottom: 0.6rem;
        display: flex;
        align-items: center;
        gap: 8px;
    }}

    .conv-round {{
        margin-bottom: 1.5rem;
    }}
    .conv-round-label {{
        font-size: 0.75rem;
        font-weight: 600;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 0.6rem;
        padding-bottom: 4px;
        border-bottom: 1px solid #252830;
    }}
    .msg-bubble {{
        border-radius: 10px;
        padding: 0.75rem 1rem;
        margin-bottom: 0.5rem;
        font-size: 0.88rem;
        line-height: 1.6;
        border-left: 3px solid var(--msg-color);
        background: #151821;
    }}
    .msg-header {{
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 4px;
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--msg-color);
    }}


    .stTextArea label {{ font-size: 0.9rem !important; font-weight: 600 !important; }}
    div[data-testid="stExpander"] details {{
        background: #1a1d27;
        border: 1px solid #252830;
        border-radius: 12px;
    }}
    .stCodeBlock {{ border-radius: 8px !important; }}
</style>
""",
    unsafe_allow_html=True,
)

_DEFAULTS = {
    "requirement": "",
    "running": False,
    "result": None,
    "current_speaker": None,
    "config_loaded": False,
}
for k, v in _DEFAULTS.items():
    st.session_state.setdefault(k, v)


def _card_html(role: Role, state: str, color: str) -> str:
    """state: 'idle' | 'active' | 'done'"""
    icon = _ROLE_ICONS[role]
    label = _ROLE_LABELS[role]
    return f"""<div class="agent-card {state}" style="--accent:{color}">
        <div class="icon">{icon}</div>
        <div class="name">{label}</div>
    </div>"""


def _pipeline_html(current_role: Role | None, approved: bool | None = None) -> str:
    roles = [Role.PM, Role.PROGRAMMER, Role.TESTER]
    html = '<div class="pipeline">'
    for i, role in enumerate(roles):
        if approved is not None:
            state = "done"
        elif current_role == role:
            state = "active"
        elif roles.index(role) < (
            roles.index(current_role) if current_role else 0
        ):
            state = "done"
        else:
            state = "idle"
        html += _card_html(role, state, _ROLE_COLORS[role])
        if i < len(roles) - 1:
            html += '<span class="pipeline-arrow">→</span>'
    html += "</div>"
    return html


def _status_badge_html(status: str) -> str:
    cls_map = {
        "idle": "idle",
        "in_progress": "running",
        "converged": "approved",
        "max_rounds_reached": "rejected",
        "error": "error",
    }
    label_map = {
        "idle": "等待开始",
        "in_progress": "讨论中",
        "converged": "✅ 已批准",
        "max_rounds_reached": "⚠️ 未批准（已达最大轮次）",
        "error": "❌ 运行出错",
    }
    cls = cls_map.get(status, "idle")
    label = label_map.get(status, status)
    return f'<span class="status-badge {cls}">{label}</span>'


def _build_config_from_sidebar() -> TeamConfig:
    return TeamConfig(
        api_key=st.session_state.api_key,
        api_base=st.session_state.api_base or None,
        model=st.session_state.model,
        temperature=st.session_state.temperature,
        max_rounds=st.session_state.max_rounds,
        timeout=st.session_state.timeout,
        max_retries=st.session_state.max_retries,
    )


with st.sidebar:
    st.markdown("### ⚙️ API 配置")

    env_config = load_config()

    api_key = st.text_input(
        "API Key",
        type="password",
        value=env_config.api_key,
        key="api_key",
        help="支持 DeepSeek / OpenAI 等兼容接口",
    )
    api_base = st.text_input(
        "API Base URL（可选）",
        value=env_config.api_base or "",
        key="api_base",
        placeholder="https://api.deepseek.com",
        help="留空则用 OpenAI 默认地址",
    )
    model = st.text_input(
        "模型",
        value=env_config.model,
        key="model",
        placeholder="gpt-4o / deepseek-chat",
    )

    st.markdown("---")
    st.markdown("### 🛠️ 团队参数")

    col1, col2 = st.columns(2)
    with col1:
        max_rounds = st.number_input(
            "最大讨论轮次",
            min_value=1,
            max_value=20,
            value=env_config.max_rounds,
            key="max_rounds",
        )
    with col2:
        temperature = st.slider(
            "Temperature",
            min_value=0.0,
            max_value=1.0,
            value=env_config.temperature,
            step=0.1,
            key="temperature",
        )

    timeout = st.number_input(
        "超时（秒）",
        min_value=30,
        max_value=300,
        value=env_config.timeout,
        key="timeout",
    )

    st.markdown("---")
    st.markdown("**🏢 团队状态**")
    if st.session_state.result is not None:
        r = st.session_state.result
        st.markdown(
            f"- 需求: `{r['requirement'][:50]}{'…' if len(r['requirement']) > 50 else ''}`"
        )
        st.markdown(f"- 讨论轮次: {len(r.get('conversation_rounds', []))}")
        st.markdown(
            f"- 状态: {_status_badge_html(r.get('status', 'idle'))}",
            unsafe_allow_html=True,
        )
        if r.get("approved"):
            st.success("✅ 代码已通过测试审查")
        else:
            st.warning("⚠️ 代码未通过审查")
    else:
        st.markdown('<span class="status-badge idle">等待输入需求</span>', unsafe_allow_html=True)

    st.markdown("---")
    st.markdown(
        "<div style='color:#64748b;font-size:0.75rem;text-align:center;'>"
        "虚拟软件外包团队 v1.0<br>"
        "Powered by AutoGen + Streamlit"
        "</div>",
        unsafe_allow_html=True,
    )

st.markdown(
    """<div class="team-header">
    <h1>🏢 虚拟软件外包团队</h1>
    <p>输入需求 → AI 团队自动讨论 → 交付 <span class="accent">文档 · 代码 · 审查</span></p>
</div>""",
    unsafe_allow_html=True,
)

pipeline_placeholder = st.empty()
_status_placeholder = st.empty()

if st.session_state.running:
    pipeline_placeholder.markdown(
        _pipeline_html(st.session_state.current_speaker),
        unsafe_allow_html=True,
    )
    _status_placeholder.markdown(
        _status_badge_html("in_progress"), unsafe_allow_html=True
    )
elif st.session_state.result is not None:
    r = st.session_state.result
    pipeline_placeholder.markdown(
        _pipeline_html(None, approved=r.get("approved")),
        unsafe_allow_html=True,
    )
    _status_placeholder.markdown(
        _status_badge_html(r.get("status", "idle")), unsafe_allow_html=True
    )
else:
    pipeline_placeholder.markdown(_pipeline_html(None), unsafe_allow_html=True)
    _status_placeholder.markdown(
        _status_badge_html("idle"), unsafe_allow_html=True
    )


disabled = st.session_state.running

requirement = st.text_area(
    "📝 描述你的需求",
    value=st.session_state.requirement,
    placeholder="例如：写一个贪吃蛇游戏，使用 Python + Pygame，要有计分和难度等级...",
    height=100,
    disabled=disabled,
    label_visibility="collapsed",
)

col_input_left, col_input_right = st.columns([1, 5])
with col_input_left:
    run_clicked = st.button(
        "🚀 开始讨论",
        type="primary",
        use_container_width=True,
        disabled=disabled or not requirement.strip(),
    )
with col_input_right:
    if st.session_state.result is not None and not disabled:
        if st.button("🔄 重新开始", use_container_width=False):
            for k in ("result", "current_speaker"):
                st.session_state[k] = None
            st.session_state.requirement = ""
            st.rerun()


if run_clicked and requirement.strip():
    if not st.session_state.api_key:
        st.error("❌ 请先在侧栏配置 API Key")
        st.stop()

    st.session_state.requirement = requirement
    st.session_state.running = True
    st.session_state.result = None
    st.session_state.current_speaker = None

    config = _build_config_from_sidebar()
    manager = TeamManager(config)

    status_ph = st.empty()
    progress_text_ph = st.empty()

    try:

        with st.spinner("🤖 AI 团队正在讨论..."):
            status_ph.markdown(
                "🧑‍💼 **产品经理** 正在分析需求...",
                unsafe_allow_html=True,
            )
            st.session_state.current_speaker = Role.PM
            pipeline_placeholder.markdown(
                _pipeline_html(Role.PM), unsafe_allow_html=True
            )
            time.sleep(0.3)

            output = manager.run(requirement.strip())


            if output.pm_document:
                status_ph.markdown(
                    "👨‍💻 **资深程序员** 正在编码...",
                    unsafe_allow_html=True,
                )
                st.session_state.current_speaker = Role.PROGRAMMER
                pipeline_placeholder.markdown(
                    _pipeline_html(Role.PROGRAMMER), unsafe_allow_html=True
                )
                time.sleep(0.3)

            if output.code:
                status_ph.markdown(
                    "🧪 **测试工程师** 正在审查代码...",
                    unsafe_allow_html=True,
                )
                st.session_state.current_speaker = Role.TESTER
                pipeline_placeholder.markdown(
                    _pipeline_html(Role.TESTER), unsafe_allow_html=True
                )
                time.sleep(0.3)

            status_ph.markdown("✅ **讨论完成！**", unsafe_allow_html=True)
            st.session_state.current_speaker = None
            pipeline_placeholder.markdown(
                _pipeline_html(None, approved=output.approved),
                unsafe_allow_html=True,
            )
            _status_placeholder.markdown(
                _status_badge_html(
                    "converged" if output.approved else "max_rounds_reached"
                ),
                unsafe_allow_html=True,
            )

            st.session_state.result = {
                "requirement": output.requirement,
                "pm_document": output.pm_document,
                "code": output.code,
                "review": output.review,
                "approved": output.approved,
                "status": "converged" if output.approved else "max_rounds_reached",
                "conversation_rounds": [
                    {
                        "round_number": r.round_number,
                        "messages": [
                            {
                                "role": m.role.value,
                                "role_label": _ROLE_LABELS[m.role],
                                "role_icon": _ROLE_ICONS[m.role],
                                "content": m.content,
                                "color": _ROLE_COLORS[m.role],
                            }
                            for m in r.messages
                        ],
                    }
                    for r in output.conversation_rounds
                ],
            }
            st.session_state.running = False
            st.rerun()

    except Exception as e:
        st.session_state.running = False
        st.session_state.current_speaker = None
        pipeline_placeholder.markdown(_pipeline_html(None), unsafe_allow_html=True)
        _status_placeholder.markdown(
            _status_badge_html("error"), unsafe_allow_html=True
        )
        st.error(f"❌ 讨论过程中出现错误：{e}")
        st.stop()


if st.session_state.result is not None and not st.session_state.running:
    r = st.session_state.result

    st.markdown("---")


    approval_color = "#4ade80" if r["approved"] else "#fca5a5"
    approval_text = "✅ 代码已通过审查，可以交付！" if r["approved"] else "⚠️ 代码未通过审查，需要修改"
    st.markdown(
        f"""<div class="result-block" style="border-color:{approval_color};">
        <h3 style="color:{approval_color};">📊 交付摘要</h3>
        <p style="color:#cbd5e1;">{approval_text}</p>
        <p style="color:#94a3b8;font-size:0.85rem;">
            需求: {r['requirement']} &nbsp;·&nbsp;
            讨论轮次: {len(r.get('conversation_rounds', []))} 轮
        </p>
    </div>""",
        unsafe_allow_html=True,
    )


    tab1, tab2, tab3, tab4 = st.tabs([
        "📋 产品需求文档",
        "💻 代码",
        "🧪 审查意见",
        "💬 讨论记录",
    ])

    with tab1:
        if r["pm_document"]:
            st.markdown(
                """<div class="result-block"><h3>📋 产品需求文档</h3></div>""",
                unsafe_allow_html=True,
            )
            st.markdown(r["pm_document"])
        else:
            st.info("暂无产品需求文档")

    with tab2:
        if r["code"]:
            st.markdown(
                """<div class="result-block"><h3>💻 代码实现</h3></div>""",
                unsafe_allow_html=True,
            )
            st.code(r["code"], language="python", line_numbers=True)
        else:
            st.info("暂无代码")

    with tab3:
        if r["review"]:
            st.markdown(
                """<div class="result-block"><h3>🧪 测试审查意见</h3></div>""",
                unsafe_allow_html=True,
            )
            st.markdown(r["review"])
        else:
            st.info("暂无审查意见")


    with tab4:
        rounds = r.get("conversation_rounds", [])
        if rounds:
            for round_data in rounds:
                rn = round_data["round_number"]
                msgs = round_data["messages"]
                if not msgs:
                    continue


                first_role = msgs[0]["role_label"] if msgs else "讨论"
                st.markdown(
                    f"""<div class="conv-round"><div class="conv-round-label">
                    第 {rn} 轮 · {first_role}
                </div></div>""",
                    unsafe_allow_html=True,
                )

                for msg in msgs:
                    color = msg["color"]
                    icon = msg["role_icon"]
                    label = msg["role_label"]
                    content = msg["content"]
                    st.markdown(
                        f"""<div class="msg-bubble" style="--msg-color:{color};">
                        <div class="msg-header">{icon} {label}</div>
                        <div>{content}</div>
                    </div>""",
                        unsafe_allow_html=True,
                    )
        else:
            st.info("暂无讨论记录")
