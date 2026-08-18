# SDD Progress — cross-device-identity-fixes

BASE: 2ee969e (基线：横幅修复 + SessionDB team_id 列)

- Task 1: complete (e646468, review clean)
- Task 2: complete (3f1e299 + 2b17c10 守卫收窄, review clean)
  - temp 移除路径=AuthContext 重写 localStorage（Task 7 修正计划机制描述）
- Task 3: complete (2d36ea4 + fe7ebe2 补测, review clean, 48 passed)
  - 预存：test_auth_middleware 4 失败 = .env AUTH_REQUIRE_LOGIN 环境敏感（建议单独 issue）
- Task 4: complete (792d185, review clean, 386+1674 passed)
  - 预存问题（中）: 直开 /chat/:id 双状态不一致（conv.activeConvId vs URL），分享链接续聊误走新建分支；建议 follow-up（Task 7 告知用户）
- Task 5: complete (7f0982c1 + b2b4564 修复, review clean, 2335 passed)
  - merge_guest_data 逐行 upsert（brief 元组方案必 500——已实证）
  - Important#1: merge prefs 碰撞回归测试已补（2 用例）
  - Important#2: anonymous 排除决策=保留排除（guest=唯一 u_ 前缀 id，anonymous 为共享兜底；排除防跨浏览器泄漏；docstring 已修+意图注释）
  - Minor#3: PUT value 缺失/None → 400（已补）
- Task 6: complete (30f40b4, review clean, 2335+ passed)
  - 模型偏好 server-first 同步（localStorage 即时渲染 + server GET 覆盖）
  - user_preferences K-V 表 + /api/preferences 接口
- Task 7: complete (c330aae + ef402cb, review clean, CI 全通过)
  - useWorkstationState 993→368 行，提取6个模块
  - test_auth_middleware autouse fixture 修复
  - m3c4d5e6f7g8 backfill sessions.team_id（7条补写）
  - CI: backend-test shard 补装 requirements.txt + mypy 补装 pypdf
