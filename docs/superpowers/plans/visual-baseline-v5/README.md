# antd v5 视觉基线（升级前存档）

antd v5 → v6 迁移前的全量关键界面截图基线，供迁移后（Task 5）逐张像素级比对。

## 版本快照

- git commit: `c07ed78`
- antd: `5.29.3`（frontend/package.json: `^5.29.3`，node_modules 实装 `5.29.3`）
- @ant-design/icons: `^6.3.2`，@ant-design/cssinjs: `^2.1.2`
- 视口：1440×900（固定，与 Task 5 复截一致）

## 环境与登录

- 前端 `http://localhost:5175`（E2E 模式，vite 代理到 8082 后端，后端含测试种子数据）
- 登录：用户菜单 → 登录 / 注册 → `e2e@test.com` / `Test@1234`
- 截图工具：chrome-devtools MCP（take_screenshot，viewport 截图）

## 截图清单（light/ 与 dark/ 各 15 张，文件名一一对应）

| 序号 | 文件 | 界面说明 | 备注 |
|---|---|---|---|
| 01 | 主工作台（会话列表+空消息流） | 侧栏会话列表 + 空消息流欢迎态 | 新建对话后的默认态 |
| 02 | 主工作台（消息流+输入区） | 会话消息流 + 输入区 | 「antd v6 迁移准备」会话 |
| 03 | Team管理表格 | 团队管理表格（13 条，Pagination 2 页） | 管理工作台默认页 |
| 04 | MCP管理表格 | 4 条（网页抓取/数据库查询/文件服务器/测试1） | |
| 05 | Skills管理表格 | 5 条 | |
| 05b | Skill导入弹窗Tab | 「导入 SKILL.md」弹窗，上传目录 Tab 选中 | 清单外补充 |
| 06 | Prompt管理弹窗 | 提示词管理表格（3 条） | 沿用 brief 命名 |
| 07 | Agent管理表格 | 3 条（deepseek-v4-flash） | |
| 08 | Output管理 | 输出约束（空态「暂无输出约束」） | 空态截图 |
| 09 | APIkey设置页 | API 管理弹窗「密钥管理」（空态「尚未配置 API Key」） | 空态截图 |
| 10 | Skill表单弹窗 | 「新建 Skill」表单（Input/Select/TextArea 组合） | |
| 11 | 登录弹窗 | 登录/注册弹窗 | |
| 12 | 会话切换后消息流 | 切换会话后的消息流 | 与 02 同会话（antd v6 迁移准备） |
| 13 | Select下拉展开态 | 主题模式 Select / 表单状态 Select 展开 | light 为设置弹窗主题模式；dark 为 Skill 表单「状态」 |
| 14 | 设置弹窗 | 系统设置（界面语言/主题模式/字体大小/AI Chat） | 主题模式 = light:浅色 / dark:深色 |

## 测试状态（npm test）

- `cd frontend && npm test`（vitest）：**192 文件全部通过（192 passed）**
- 用例：2141 passed | 1 todo（2142 total），Duration ~34s
- 日志中的 `Error: Boom` 为 ErrorBoundary 测试用例故意抛出，非失败

## 注意事项 / 已知差异

1. **light 09/14 曾误截为深色版**（上一轮 subagent 结束时留在深色态），已删除并以浅色重截。
2. **dark 02 与 dark 12 视图内容相同**（同一会话「antd v6 迁移准备」的消息流，仅会话列表焦点项不同），符合 brief「切换会话后消息流」的语义，但比对时这两张预期基本一致。
3. 12 拍摄的是「antd v6 迁移准备」（light/dark 均同会话，可严格对比）；「API 网关调研」「项目周报讨论」会话为空消息流（显示欢迎态），故未用于 12。
4. 深色验证：截图时 `<html class="dark">`、body 背景 `rgb(15,17,23)`；浅色 `html` 无 class、背景 `#fff`。
5. 08/09 为数据空态截图（种子数据未含输出约束与 API Key），若 Task 5 复截时出现数据则需人为对齐或直接比对空态。
