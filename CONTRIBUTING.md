# 📝 贡献指南

感谢您对AgentStudio项目的关注！本指南将帮助您了解如何参与项目开发。

---

## 📋 目录

- [行为准则](#行为准则)
- [如何贡献](#如何贡献)
- [开发环境](#开发环境)
- [代码规范](#代码规范)
- [提交规范](#提交规范)
- [Pull Request 流程](#pull-request-流程)
- [问题报告](#问题报告)
- [功能建议](#功能建议)

---

## 🤝 行为准则

### 我们的标准

- **尊重**：尊重每一位贡献者
- **包容**：欢迎不同背景和经验的人
- **专业**：保持专业和建设性的讨论
- **负责**：对自己的行为负责

### 不可接受的行为

- 使用性暗示的语言或图像
- 公开骚扰或侮辱
- 发布他人隐私信息
- 其他不专业或不道德的行为

---

## 🚀 如何贡献

### 贡献方式

1. **代码贡献**：修复 bug、添加功能、优化性能
2. **文档贡献**：改进文档、添加示例、翻译
3. **测试贡献**：添加测试用例、报告 bug
4. **设计贡献**：改进 UI/UX、添加设计稿

### 贡献流程

```
1. Fork 项目
   ↓
2. 创建功能分支
   ↓
3. 开发并测试
   ↓
4. 提交更改
   ↓
5. 推送到 Fork
   ↓
6. 创建 Pull Request
   ↓
7. 代码审查
   ↓
8. 合并到主分支
```

---

## 💻 开发环境

### 环境要求

| 工具 | 版本 | 说明 |
|------|------|------|
| Node.js | >= 18.0 | 前端运行时 |
| Python | >= 3.11 | 后端运行时 |
| PostgreSQL | >= 16 | 数据库 |
| Redis | >= 7.2 | 缓存 |
| Git | >= 2.40 | 版本控制 |

### 安装步骤

```bash
# 1. 克隆你的 Fork
git clone https://github.com/YOUR_USERNAME/virtual-team.git
cd virtual-team

# 2. 添加上游仓库
git remote add upstream https://github.com/ORIGINAL_REPO/virtual-team.git

# 3. 安装前端依赖
cd frontend
npm install

# 4. 安装后端依赖
cd ..
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# 或
.venv\Scripts\activate     # Windows
pip install -r requirements.txt

# 5. 配置环境变量
cp .env.example .env
vim .env  # 编辑配置

# 6. 启动开发服务器
# 终端 1：前端
cd frontend
npm run dev

# 终端 2：后端
python -m virtual_team.main
```

### 开发工具

推荐使用以下 IDE/编辑器：

- **VS Code** + 扩展：
  - ESLint
  - Prettier
  - TypeScript Vue Plugin (Volar)
  - Python
  - Pylance

- **PyCharm** + 插件：
  - ESLint
  - Prettier

---

## 📏 代码规范

### TypeScript/React 规范

```typescript
// ✅ 推荐
interface UserProps {
  name: string;
  age: number;
  onSelect?: (user: User) => void;
}

export function UserCard({ name, age, onSelect }: UserProps) {
  const handleClick = () => {
    onSelect?.({ name, age });
  };

  return (
    <div onClick={handleClick}>
      <h3>{name}</h3>
      <p>Age: {age}</p>
    </div>
  );
}

// ❌ 避免
function UserCard(props: any) {
  return (
    <div onClick={() => props.onSelect(props)}>
      <h3>{props.name}</h3>
      <p>Age: {props.age}</p>
    </div>
  );
}
```

### Python 规范

```python
# ✅ 推荐
from typing import Optional
from pydantic import BaseModel

class UserCreate(BaseModel):
    """创建用户的数据模型"""
    name: str
    age: int
    email: Optional[str] = None

async def create_user(user_data: UserCreate) -> User:
    """
    创建新用户
    
    Args:
        user_data: 用户数据
        
    Returns:
        创建的用户对象
        
    Raises:
        ValueError: 如果用户数据无效
    """
    if user_data.age < 0:
        raise ValueError("年龄不能为负数")
    
    # 创建用户逻辑
    return User(**user_data.dict())

# ❌ 避免
def create_user(user_data):
    # 没有类型提示
    # 没有文档字符串
    # 没有错误处理
    return user_data
```

### 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 文件名 | kebab-case | `user-card.tsx` |
| 组件名 | PascalCase | `UserCard` |
| 函数名 | camelCase | `getUserById` |
| 变量名 | camelCase | `userName` |
| 常量名 | UPPER_SNAKE_CASE | `API_BASE_URL` |
| 类型名 | PascalCase | `UserProps` |
| 接口名 | PascalCase + I前缀(可选) | `IUser` 或 `User` |

### 文件结构

```
module-name/
├── ModuleName.tsx          # 主组件
├── ModuleName.test.tsx     # 测试文件
├── module.types.ts         # 类型定义
├── module.constants.ts     # 常量
├── useModule.ts            # 自定义 Hook
├── module.utils.ts         # 工具函数
└── index.ts                # 公共导出
```

---

## 📝 提交规范

### Commit Message 格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type 类型

| Type | 说明 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat(agent): 添加 Agent 版本管理` |
| `fix` | 修复 bug | `fix(prompt): 修复提示词保存失败` |
| `docs` | 文档更新 | `docs: 更新 README 安装说明` |
| `style` | 代码格式（不影响功能） | `style: 格式化代码` |
| `refactor` | 重构（不新增功能/修复 bug） | `refactor(agent): 重构 Agent 配置逻辑` |
| `test` | 测试相关 | `test: 添加 Agent 管理单元测试` |
| `chore` | 构建/工具变更 | `chore: 更新 ESLint 配置` |
| `perf` | 性能优化 | `perf: 优化列表渲染性能` |
| `ci` | CI/CD 相关 | `ci: 添加 GitHub Actions` |
| `revert` | 回滚 | `revert: 回滚 Agent 配置变更` |

### Scope 范围

| Scope | 说明 |
|-------|------|
| `agent` | Agent 管理模块 |
| `prompt` | 提示词管理模块 |
| `output` | 输出约束模块 |
| `tool` | 工具管理模块 |
| `mcp` | MCP 管理模块 |
| `skill` | Skills 管理模块 |
| `team` | 团队管理模块 |
| `api` | API 相关 |
| `ui` | UI 组件 |
| `auth` | 认证相关 |

### 示例

```bash
# 简单提交
git commit -m "feat(agent): 添加 Agent 克隆功能"

# 带详细说明
git commit -m "fix(prompt): 修复提示词导入失败问题

- 修复 JSON 解析错误
- 添加文件格式验证
- 改进错误提示信息

Closes #123"

# 带破坏性变更
git commit -m "feat(api)!: 重构 Agent API

BREAKING CHANGE: Agent API 响应格式变更"
```

---

## 🔍 Pull Request 流程

### 1. 创建分支

```bash
# 同步上游
git fetch upstream

# 创建功能分支
git checkout -b feature/amazing-feature upstream/develop
```

### 2. 开发并测试

```bash
# 开发
# ...

# 运行测试
npm run test

# 运行类型检查
npm run typecheck

# 运行代码检查
npm run lint
```

### 3. 提交更改

```bash
git add .
git commit -m "feat(module): 添加新功能"
```

### 4. 推送到 Fork

```bash
git push origin feature/amazing-feature
```

### 5. 创建 Pull Request

在 GitHub 上创建 PR，填写以下信息：

```markdown
## 描述
简要描述这个 PR 的内容

## 变更类型
- [ ] 新功能 (feat)
- [ ] Bug 修复 (fix)
- [ ] 文档更新 (docs)
- [ ] 代码重构 (refactor)
- [ ] 其他: ___

## 测试
- [ ] 单元测试通过
- [ ] 集成测试通过
- [ ] 手动测试完成

## 截图（如适用）
添加相关截图

## 相关 Issue
Closes #123
```

### 6. 代码审查

- 至少需要 2 个维护者批准
- 所有 CI 检查必须通过
- 根据反馈进行修改

### 7. 合并

审查通过后，维护者会将 PR 合并到 `develop` 分支。

---

## 🐛 问题报告

### 报告 Bug

请使用 GitHub Issues 报告 Bug，并包含以下信息：

```markdown
## Bug 描述
清晰简洁地描述 Bug

## 复现步骤
1. 进入 '...'
2. 点击 '...'
3. 滚动到 '...'
4. 看到错误

## 期望行为
描述期望的行为

## 实际行为
描述实际的行为

## 截图
如适用，添加截图

## 环境信息
- 操作系统: [例如 macOS 14.0]
- 浏览器: [例如 Chrome 120]
- Node.js 版本: [例如 18.17]
- Python 版本: [例如 3.11.5]

## 日志
```
添加相关日志
```
```

### 安全漏洞

**请勿**在 Issues 中报告安全漏洞。请发送邮件至 security@example.com。

---

## 💡 功能建议

### 提交建议

```markdown
## 功能描述
清晰简洁地描述功能

## 问题背景
描述这个功能解决的问题

## 解决方案
描述你建议的解决方案

## 替代方案
描述你考虑过的其他方案

## 额外信息
添加任何其他相关信息
```

---

## 📚 参考资源

- [项目文档](docs/)
- [API 文档](http://localhost:8000/docs)
- [React 文档](https://react.dev/)
- [FastAPI 文档](https://fastapi.tiangolo.com/)
- [Conventional Commits](https://www.conventionalcommits.org/)

---

## 🙏 感谢

感谢所有贡献者的支持！
