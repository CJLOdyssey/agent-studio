# 提示词治理规范

> 合规与管理层制度规范：角色权责 → SLA → 数据保留 → 定期审计。
> 配套文档：[提示词工程规范](prompt-engineering-standards.md) · [提示词运行时架构](prompt-runtime-architecture.md)

---

## 目录

1. [RACI 矩阵](#1-raci-矩阵)
2. [角色职责定义](#2-角色职责定义)
3. [审批链路](#3-审批链路)
4. [异常处理 SOP](#4-异常处理-sop)
5. [SLA 定义](#5-sla-定义)
6. [与已有流程的集成](#6-与已有流程的集成)
7. [数据保留与定期审计](#7-数据保留与定期审计)

---

## 1. RACI 矩阵

RACI：**R**esponsible（执行者） / **A**ccountable（负责人） / **C**onsulted（被咨询） / **Informed（被知会）**

| 活动 | 提示词工程师 | 合规审查员 | 领域专家 | 业务方 | 开发/infra | QA | 运维 |
|---|---|---|---|---|---|---|---|
| **场景拆分** | R / A | C | C | C | — | — | — |
| **模板编写/修改** | R / A | — | C | C | — | — | — |
| **合规红线扫描** | C | R / A | — | — | — | — | — |
| **Code Review（质量）** | R / A | — | C | — | — | — | — |
| **Code Review（合规）** | C | R / A | — | — | — | — | — |
| **测试用例编写** | R | — | C | — | — | A | — |
| **离线回归测试** | C | — | — | — | R / A | — | — |
| **灰度发布审批** | C | C | C | A | R | — | — |
| **全量上线审批** | C | C | C | A | R | — | — |
| **A/B 实验配置** | R | — | — | C | A | — | — |
| **效果指标分析** | R | — | C | C | — | A | — |
| **Prompt 引擎开发** | C | — | — | — | R / A | — | — |
| **知识库权限配置** | — | C | C | A | R | — | — |
| **线上监控配置** | C | — | — | — | R | — | A |
| **异常回滚决策** | C | C | C | A | R | — | I |
| **合规事件处理** | I | R | — | C | — | — | A |

## 2. 角色职责定义

```yaml
roles:
  提示词工程师:
    title: "Prompt Engineer"
    skills:
      - "掌握模板工程化方法（四段式结构）"
      - "熟悉各类 LLM 的边界和偏好"
      - "理解业务场景和用户意图"
    responsibilities:
      - "场景拆分与模板编写"
      - "编写与维护测试用例"
      - "分析 A/B 测试效果并推动迭代"
      - "参与 Code Review"
    gates:
      - "所有模板 PR 必须经过其 Review 才能合并"

  合规审查员:
    title: "Compliance Reviewer"
    skills:
      - "熟悉行业法规（广告法、数据安全法、金融合规等）"
      - "了解 prompt 注入和泄露攻击模式"
    responsibilities:
      - "模板的合规红线审查"
      - "输出脱敏规则审核"
      - "合规事件复盘"
    gates:
      - "合规审查未通过的模板不得进入灰度"

  业务方:
    title: "Business Owner"
    responsibilities:
      - "审批场景定义和模板发布"
      - "提供领域知识输入"
      - "确认效果指标是否满足业务需求"
    gates:
      - "灰度/全量上线必须得到业务方书面确认"

  开发/infra:
    title: "Infrastructure Engineer"
    responsibilities:
      - "Prompt 引擎的开发与维护"
      - "CI/CD 流水线搭建"
      - "模型网关集成"
      - "监控告警系统建设"

  QA:
    title: "Quality Assurance"
    responsibilities:
      - "测试套件管理"
      - "离线评估 Pipeline 维护"
      - "效果指标的可信度保障"
```

## 3. 审批链路

```
场景拆分 → [提示词工程师] → [业务方确认]
    │
    ▼
模板编写 → [提示词工程师]
    │
    ▼
提交 PR  → 自动合规扫描 + 自动回归测试
    │
    ▼
Code Review → [提示词工程师] + [合规审查员]
    │
    ▼
灰度发布 → [业务方审批]
    │
    ▼
全量上线 → [业务方审批]
    │
    ▼
线上监控 → [运维] + [提示词工程师]
    │
    ▼
异常回滚 → [业务方决策] + [开发执行]
```

## 4. 异常处理 SOP

| 场景 | 响应时间 | 责任人 | 操作 |
|---|---|---|---|
| 合规事件（高危） | 立即 | 合规审查员 | 阻断请求 → 下架模板 → 复盘 |
| 准确率 < 阈值 | 15min | 提示词工程师 | 评估 → 回滚 / 热修复 |
| 用户满意度骤降 | 30min | 提示词工程师 + 业务方 | 暂停灰度 → 分析 → 决策 |
| 成本异常 | 1h | 开发/infra | 定位原因（token 浪费 / 死循环）→ 修复 |
| 系统故障（网关/引擎） | 立即 | 开发/infra | 按系统故障 SOP 处理 |

## 5. SLA 定义

明确各环节的时效承诺和可用性指标，作为团队考核和服务等级依据。

```yaml
# sla/definitions.yaml
sla:
  # 发布时效
  template_release:
    description: "从 PR 创建到全量上线"
    target:
      p50: "4 小时"
      p90: "1 个工作日"
      p99: "2 个工作日"
    exceptions:
      - "合规审查发现高危问题 → 阻塞发布，不计入 SLA"
      - "灰度 A/B 测试未通过 → 退回迭代，不计入 SLA"

  # 故障响应
  incident_response:
    compliance_high:
      description: "合规高危事件（数据泄露/红线触发）"
      response_time: "立即（< 5 分钟）"
      resolution_time: "1 小时"
      escalation: "通知安全负责人 + 合规团队"
    
    accuracy_degradation:
      description: "准确率低于阈值"
      response_time: "15 分钟"
      resolution_time: "2 小时"
    
    performance_degradation:
      description: "P95 延迟 > 3s 或错误率 > 2%"
      response_time: "15 分钟"
      resolution_time: "1 小时"
    
    cost_anomaly:
      description: "成本环比增长 > 50%"
      response_time: "1 小时"
      resolution_time: "4 小时"

  # 可用性
  availability:
    prompt_engine: "≥ 99.9%"              # Prompt 渲染引擎
    cache_hit_rate: "≥ 85%"                # 缓存命中率
    api_availability: "≥ 99.5%"            # 管理 API
    model_gateway: "≥ 99.95%"              # 模型网关

  # 质量指标
  quality:
    accuracy_target: "≥ 0.90"              # 离线评估准确率
    format_compliance: "≥ 0.95"            # 输出格式合规率
    safety_pass_rate: "= 1.0"              # 安全红线零通过
    user_satisfaction: "≥ 4.0 / 5.0"       # 用户评分
```

## 6. 与已有流程的集成

```yaml
integration:
  # 开发流程
  pr_template:
    path: ".github/PULL_REQUEST_TEMPLATE/prompt-change.md"
    required_sections:
      - "变更摘要"
      - "场景 ID 列表"
      - "测试结果截图（回归报告链接）"
      - "合规自检清单"
      - "业务方确认人"

  # 发布流程
  release_stages:
    draft:    "feature branch + 本地测试"
    review:   "PR + Code Review + 合规审查 + 回归测试"
    staging:  "merge 到 stage → 灰度 5% → 20% → 50%"
    live:     "merge 到 main → 全量"
    rollback: "revert / 版本切换"

  # 告警通知
  notification:
    accuracy_drop:
      channels: ["企业微信/钉钉群", "短信"]
      targets: ["提示词工程师", "业务方"]
    compliance_event:
      channels: ["电话", "企业微信"]
      targets: ["合规审查员", "安全负责人"]
```

## 7. 数据保留与定期审计

```yaml
# data-governance/retention.yaml
data_retention:
  prompt_templates:
    online: "保留最近 20 个版本"                    # 数据库在线
    archived: "之前的版本归档到冷存储（对象存储）"
    retention: "永久（法定存证需要）"
  
  review_logs:
    retention: "2 年"
    destroy_after: "2 年后匿名化处理"
    reason: "满足合规审计要求"
  
  ab_test_results:
    online: "90 天"                               # 数据库在线
    archived: "90 天后归档"
    retention: "1 年"
    destroy_after: "超过 1 年删除原始数据，仅保留统计摘要"
  
  user_feedback:
    raw: "保留 180 天"                             # 含用户身份
    deidentified: "保留 1 年（去标识化后）"
    destroy_after: "超过 1 年删除"

  cost_logs:
    retention: "1 年"
    aggregation: "超过 1 年仅保留月汇总"

periodic_audit:
  title: "定期审计"
  frequency: "每季度"
  scope:
    - "所有在线模板的合规抽检（至少 20% 样本）"
    - "知识库权限配置复核（最小权限原则）"
    - "成本偏差分析（预算 vs 实际）"
    - "历史 A/B 测试效果复盘"
    - "废弃模板清理（无人引用的场景）"
    - "变更通知接收方确认（是否仍有效）"
  
  roles:
    owner: "合规审查员"
    participant: ["提示词工程师", "业务方", "开发/infra"]
  
  output:
    - "审计报告（含发现项、风险等级、整改建议）"
    - "整改跟踪表（下一季度前关闭）"
```

---

## 附录：落地路线图

| 阶段 | 内容 | 时间 |
|---|---|---|
| **P0 — 基础建设** | 场景注册表 + 模板四段式结构 + Git 版本管理 | 第 1-2 周 |
| **P1 — 流程规范** | RACI 矩阵定义 + Code Review 流程 + PR 模板 + 审批链路 | 第 2-3 周 |
| **P2 — 变量注入** | 企业变量体系 + 渲染引擎 + 模板变量插值 | 第 3-4 周 |
| **P3 — 质量门禁** | 测试套件搭建 + 离线回归 Pipeline + 合规扫描集成 | 第 4-6 周 |
| **P4 — 灰度能力** | A/B 测试框架 + 流量路由 + 指标采集 | 第 6-8 周 |
| **P5 — 管控闭环** | 模型网关绑定 + 知识库 ACL + Prompt 引擎集成 | 第 8-10 周 |
| **P6 — 自动化运维** | 监控告警 + 自动回滚 + 异常 SOP 落地 | 第 10-12 周 |
