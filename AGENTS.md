# AgentStudio — OpenCode 开发环境指南

代码获取优先级、skills 用法、代码质量约束见全局 `~/.config/opencode/AGENTS.md`（本项目有 `.codegraph/` 索引，对源码先 `codegraph_explore`）。

## 网络环境（2026-08-01 实测结论）

- **IPv6 黑洞已修复**：`NODE_OPTIONS="--dns-result-order=ipv4first"` 已写入 `~/.bashrc` + `~/.profile`（新会话生效；旧会话需重启 opencode）
- **黑洞域名（IPv4/IPv6 双栈不通，本地无法修复，直接换源勿重试）**：`docs.claude.com` / `platform.claude.com` / `code.claude.com` / `docs.cursor.com`
  - Claude 文档 → github-mcp 拉官方仓库（如 `anthropics/skills`、`anthropics/claude-code`）；Cursor → 镜像或 GitHub 镜像源
- **间歇波动**（`opencode.ai`、`modelcontextprotocol.io` 时通时断）：重试 1-2 次，仍失败换源
- **实践**：优先 github-mcp 拉文档/规范（`api.github.com` 实测稳定）；webfetch 失败先判断「黑洞域名（换源）」还是「间歇波动（重试）」；竞品/规范分析需 ≥3 独立权威源多源参照（见下）

## 多源参照（做行业标准/最佳实践/方案对比判断前必做）

**禁止凭模型记忆直接断言**（曾两次据此下错结论，「就近式是前端标准」「测试目录应统一」均被多源核实推翻）。流程：

1. 把论断拆成可证伪的原子断言（例："就近式是社区标准" → 「Python 后端主流」「前端主流」两个独立断言）
2. 选 ≥3 个权威源，分三类：官方文档/README（工具/框架官方仓库）、知名项目实证（领域标杆代码，如 Flask/Django、React/Ant Design）、独立第三方
3. 核实方法（github-mcp 优先）：工具能力→拉官方 README 核对参数/推荐做法；生态惯例→读 2-3 个标杆仓库顶层目录结构数组织方式；仓库名不确定→先 `search_repositories`
4. 分生态下结论，不跨生态套用（结论模板：「在 X 生态，Y 是主流；本项目采用 Z 符合该生态惯例」）
5. 输出标注证据等级：✅ 官方/实证核实 / ⚠️ 推断无法公开确认 / ❌ 已证伪——错误结论必须显式修正并说明依据
6. 官方 README 明确推荐的做法（如 pytest-split「.test_durations 应存 repo」）优先照做，勿自创变通
7. 触发：测试体系/CI 方案、目录结构、框架选型、规范符合性、竞品对标、"行业标准是什么"类提问

## 项目启动方式

### 方式一：全容器（Docker Compose）
```bash
docker compose -f docker/compose.base.yml -f docker/compose.local.yml up -d
```
服务：postgres(5432) / redis(6379) / backend(8080) / celery / frontend(5173)。首次构建镜像（pip 用清华镜像）。前端 `http://localhost:5173`，后端 `http://localhost:8080`。

### 方式二：混合模式（开发推荐）
```bash
docker compose -f docker/compose.base.yml -f docker/compose.local.yml up -d postgres redis
DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5432/backend" make dev-backend  # 后端 8081，须显式注入 DATABASE_URL
cd frontend && npm run dev  # 前端 5174（vite.config.ts 固定，勿用 --port 覆盖；CORS 只认 5174）
```
前端 `http://localhost:5174`，后端 `http://localhost:8081`（`make health` 探活）。redis 容器缺 6379 端口映射时用 `docker compose -f docker/compose.base.yml -f docker/compose.local.yml up -d redis` 重建。

### 方式三：E2E 测试环境
```bash
make e2e-env          # 一键拉起 postgres + redis
PORT=8082 make dev-backend   # 必须 8082：conftest.py BASE 硬编码；默认 8081 会让 E2E 全挂
make test-e2e         # pytest backend/tests/e2e/ -m integration
```
前端 E2E：`cd frontend && npm run dev:e2e`（vite 5175，代理到 8082）

### 方式四：生产部署（docker/compose.prod.yml，预留）
```bash
docker compose -f docker/compose.base.yml -f docker/compose.prod.yml build   # 可省略，直接拉 ACR latest
POSTGRES_PASSWORD=... CORS_ORIGIN=https://your-domain docker compose -f docker/compose.base.yml -f docker/compose.prod.yml up -d
```
ACR 镜像 `crpi-j0fhvkobexa3ilkn.cn-shenzhen.personal.cr.aliyuncs.com/agent-studio/*`；独立网络/`-prod` 容器名、子网 `172.28.0.0/16`、默认 `CHECKPOINTER_BACKEND=postgres`；复用同一 `docker/Dockerfile`（已含 ARG 重声明/entrypoint/pid/celery `-A broker` 修复）；Redis Sentinel 切换见 compose 内注释。

### 端口速查
| 模式 | 后端 | 前端 |
|---|---|---|
| 混合（方式二） | 8081 | 5174 |
| 全容器（方式一） | 8080 | 5173 |
| E2E（方式三） | 8082 | 5175 |

后端 `PORT`、前端 `VITE_DEV_PORT`（+ `VITE_API_BASE_URL` 指到对应后端）均可环境变量覆盖。