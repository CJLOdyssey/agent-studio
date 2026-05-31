import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, User, Settings, Code2, Server, TestTube, Palette, 
  Send, Paperclip, Layout, CheckCircle2, Loader2, ChevronRight, ChevronDown,
  Terminal, Maximize2, PanelRightClose, Sparkles, FolderKanban,
  GitBranch, Play, Bug, RefreshCw, MessageSquare, Plus, Users, Pencil
} from 'lucide-react';

// --- 预设的 Teams 与 Agents 数据 ---
const INITIAL_TEAMS = [
  {
    id: 'team-core',
    name: '核心平台团队',
    isExpanded: true,
    agents: [
      { id: 'ui', name: 'UI Agent', role: '界面与交互设计', icon: Palette, color: 'text-pink-400', bg: 'bg-pink-600/20', border: 'border-pink-500/30' },
      { id: 'frontend', name: '前端 Agent', role: 'React/Vue 开发', icon: Code2, color: 'text-cyan-400', bg: 'bg-cyan-600/20', border: 'border-cyan-500/30' },
      { id: 'backend', name: '后端 Agent', role: 'API 与数据库设计', icon: Server, color: 'text-amber-400', bg: 'bg-amber-600/20', border: 'border-amber-500/30' },
      { id: 'qa', name: '测试 Agent', role: '自动化与安全测试', icon: TestTube, color: 'text-emerald-400', bg: 'bg-emerald-600/20', border: 'border-emerald-500/30' },
    ]
  },
  {
    id: 'team-growth',
    name: '增长业务团队',
    isExpanded: false,
    agents: []
  }
];

// --- 模拟对话数据 ---
const INITIAL_MESSAGES = [
  {
    id: 1,
    role: 'user',
    content: '团队们好，我们需要开发一个简单的“用户登录与注册”模块。包含一个现代感的前端页面和对应的后端验证接口。'
  },
  {
    id: 2,
    role: 'agent',
    agentId: 'ui',
    content: '收到需求。我已经构思了一个基于极简风格的登录界面，使用了卡片式布局和毛玻璃效果。设计规范已就绪，交接给前端。',
    action: { type: 'design', label: '产出设计 Token 与布局草图' }
  },
  {
    id: 3,
    role: 'agent',
    agentId: 'frontend',
    type: 'process',
    plan: [
      { step: '解析 UI Agent 提供的设计 Token', status: 'completed' },
      { step: '使用 React + Tailwind 构建 AuthForm.jsx', status: 'completed' },
      { step: '预留 onSubmit 接口对接后端', status: 'completed' }
    ],
    content: 'UI 效果很棒。我已经完成了 React 组件的开发。代码已提交到右侧工作区，支持响应式布局。@后端 Agent，需要你提供 /api/auth/login 的接口规范。',
    hasArtifact: true,
    artifactType: 'code',
    artifactTitle: 'AuthForm.jsx'
  },
  {
    id: 4,
    role: 'agent',
    agentId: 'backend',
    content: '已收到请求。我正在生成基于 Node.js/Express 的 AuthController.js，包含 JWT 签发和密码 Bcrypt 加密逻辑。',
    isTyping: true // 模拟正在打字状态
  }
];

export default function AgentInterface() {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [teams, setTeams] = useState(INITIAL_TEAMS);
  const [inputValue, setInputValue] = useState('');
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('code'); // code, preview
  const messagesEndRef = useRef(null);

  // 新增：用于重命名团队的状态
  const [editingTeamId, setEditingTeamId] = useState(null);
  const [editTeamName, setEditTeamName] = useState('');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const newUserMsg = { id: Date.now(), role: 'user', content: inputValue };
    setMessages(prev => [...prev, newUserMsg]);
    setInputValue('');
    
    // 简单的模拟触发某个Agent回复
    setTimeout(() => {
      const qaMsg = {
        id: Date.now() + 1,
        role: 'agent',
        agentId: 'qa',
        content: '我正在监听代码变更，准备编写针对刚才提交的前端组件和 API 的自动化集成测试用例。',
        action: { type: 'test', label: '准备生成 Playwright 测试' }
      };
      setMessages(prev => [...prev, qaMsg]);
    }, 1500);
  };

  // --- 团队与 Agent 管理操作 ---
  const toggleTeam = (teamId) => {
    setTeams(teams.map(t => t.id === teamId ? { ...t, isExpanded: !t.isExpanded } : t));
  };

  const handleAddTeam = () => {
    const newTeamId = `team-${Date.now()}`;
    const newTeam = { id: newTeamId, name: '新研发团队', isExpanded: true, agents: [] };
    setTeams([...teams, newTeam]);
    // 新增团队后自动进入编辑模式
    setEditingTeamId(newTeamId);
    setEditTeamName(newTeam.name);
  };

  const handleAddAgent = (e, teamId) => {
    e.stopPropagation(); // 阻止触发折叠操作
    // 模拟增加一个新的默认全栈 Agent
    const newAgent = { 
      id: `agent-${Date.now()}`, 
      name: '全栈 Agent', 
      role: '全栈开发支持', 
      icon: Bot, 
      color: 'text-purple-400', 
      bg: 'bg-purple-600/20', 
      border: 'border-purple-500/30' 
    };
    setTeams(teams.map(t => t.id === teamId ? { ...t, agents: [...t.agents, newAgent], isExpanded: true } : t));
  };

  // --- 重命名相关逻辑 ---
  const startEditTeam = (e, team) => {
    e.stopPropagation();
    setEditingTeamId(team.id);
    setEditTeamName(team.name);
  };

  const saveTeamName = (teamId) => {
    if (editTeamName.trim() !== '') {
      setTeams(teams.map(t => t.id === teamId ? { ...t, name: editTeamName.trim() } : t));
    }
    setEditingTeamId(null);
  };

  const handleTeamNameKeyDown = (e, teamId) => {
    if (e.key === 'Enter') {
      saveTeamName(teamId);
    } else if (e.key === 'Escape') {
      setEditingTeamId(null);
    }
  };

  // 提取所有团队的 Agents（用于对话中匹配头像和信息）
  const allAgents = teams.flatMap(t => t.agents);

  return (
    <div className="flex h-screen w-full bg-[#0d1117] text-slate-300 font-sans overflow-hidden">
      
      {/* 左侧边栏 - 团队管理面板 */}
      <aside className="w-64 bg-[#161b22] border-r border-slate-800 flex flex-col flex-shrink-0 z-10 shadow-lg shadow-black/20">
        <div className="p-4 border-b border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <Bot size={18} />
          </div>
          <div>
            <h1 className="text-slate-100 font-bold tracking-wide">DevAgents OS</h1>
            <p className="text-xs text-slate-400">虚拟开发团队</p>
          </div>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          <button className="w-full mb-6 flex items-center justify-center gap-2 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 py-2.5 px-4 rounded-xl transition-colors border border-indigo-500/30">
            <Sparkles size={16} />
            <span className="text-sm font-medium">发起新迭代 (Sprint)</span>
          </button>

          {/* 团队目录结构 */}
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <div className="flex items-center gap-2">
              <Users size={14} />
              我的团队
            </div>
            <button onClick={handleAddTeam} className="p-1 hover:bg-[#0d1117] rounded text-slate-400 hover:text-slate-200 transition-colors border border-transparent hover:border-slate-700" title="新建团队">
              <Plus size={14} />
            </button>
          </div>

          <div className="space-y-3 mb-6">
            {teams.map(team => (
              <div key={team.id} className="flex flex-col">
                {/* 团队标题行 */}
                <div 
                  className="group flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-[#0d1117] cursor-pointer transition-colors border border-transparent hover:border-slate-800"
                  onClick={() => !editingTeamId && toggleTeam(team.id)}
                >
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    {team.isExpanded ? <ChevronDown size={14} className="text-slate-500 shrink-0" /> : <ChevronRight size={14} className="text-slate-500 shrink-0" />}
                    
                    {editingTeamId === team.id ? (
                      <input
                        type="text"
                        value={editTeamName}
                        onChange={(e) => setEditTeamName(e.target.value)}
                        onBlur={() => saveTeamName(team.id)}
                        onKeyDown={(e) => handleTeamNameKeyDown(e, team.id)}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                        className="bg-[#0d1117] text-[13px] font-medium text-slate-200 border border-indigo-500/50 rounded px-1 outline-none w-full"
                      />
                    ) : (
                      <>
                        <span className="text-[13px] font-medium text-slate-300 truncate">{team.name}</span>
                        <span className="text-[10px] bg-[#0d1117] border border-slate-800 text-slate-400 px-1.5 py-0.5 rounded-md shrink-0">{team.agents.length}</span>
                      </>
                    )}
                  </div>

                  {editingTeamId !== team.id && (
                    <div className="opacity-0 group-hover:opacity-100 flex items-center transition-all shrink-0 ml-1">
                      <button 
                        onClick={(e) => startEditTeam(e, team)}
                        className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200" 
                        title="重命名团队"
                      >
                        <Pencil size={12} />
                      </button>
                      <button 
                        onClick={(e) => handleAddAgent(e, team.id)}
                        className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200" 
                        title="在此团队添加新 Agent"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {/* 团队内的 Agents 列表 */}
                {team.isExpanded && (
                  <ul className="space-y-1 mt-1 pl-4 ml-2.5 border-l border-slate-800/50">
                    {team.agents.map(agent => (
                      <li key={agent.id} className="group p-2 rounded-lg hover:bg-[#0d1117] border border-transparent hover:border-slate-700 transition-colors flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-md flex items-center justify-center ${agent.bg} ${agent.border} border`}>
                          <agent.icon size={14} className={agent.color} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-[13px] font-medium text-slate-200">{agent.name}</span>
                            <span className="flex h-1.5 w-1.5 relative">
                              {agent.id === 'backend' ? (
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500 animate-pulse"></span>
                              ) : (
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                              )}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 block truncate">{agent.role}</span>
                        </div>
                      </li>
                    ))}
                    {team.agents.length === 0 && (
                      <li className="text-[11px] text-slate-600 italic py-2 pl-2">
                        该团队暂无 Agent
                      </li>
                    )}
                  </ul>
                )}
              </div>
            ))}
          </div>
          
          <div className="mb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <FolderKanban size={14} />
            最近项目
          </div>
          <ul className="space-y-1">
             <li className="cursor-pointer text-sm text-indigo-400 py-1.5 px-2 rounded hover:bg-slate-800/50"># 用户鉴权系统重构</li>
             <li className="cursor-pointer text-sm text-slate-400 py-1.5 px-2 rounded hover:bg-slate-800/50"># 支付模块压测</li>
          </ul>
        </div>
        
        {/* 设置按钮区域 */}
        <div className="p-4 border-t border-slate-800 shrink-0">
           <button className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/50 transition-colors text-slate-400 hover:text-slate-200">
             <Settings size={18} />
             <span className="text-sm font-medium">系统设置</span>
           </button>
        </div>
      </aside>

      {/* 中间 - 团队沟通协作区 */}
      <main className="flex-1 flex flex-col relative min-w-[450px]">
        {/* 顶部栏 */}
        <header className="h-14 border-b border-slate-800 bg-[#161b22] flex items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center gap-3">
            <span className="text-slate-200 font-semibold text-sm flex items-center gap-2">
              <MessageSquare size={16} className="text-slate-400"/>
              主控频道 (Main Channel)
            </span>
          </div>
          {!isWorkspaceOpen && (
            <button 
              onClick={() => setIsWorkspaceOpen(true)}
              className="flex items-center gap-2 text-xs text-slate-400 hover:text-indigo-400 transition-colors bg-[#0d1117] px-3 py-1.5 rounded-lg border border-slate-700 shadow-sm"
            >
              <Layout size={14} />
              打开代码工作区
            </button>
          )}
        </header>

        {/* 消息列表 */}
        <div className="flex-1 overflow-y-auto p-6 scroll-smooth bg-gradient-to-b from-[#0d1117] to-[#161b22]/50">
          <div className="max-w-3xl mx-auto space-y-6 pb-10">
            <div className="text-center text-xs text-slate-600 mb-8 border-b border-slate-800/50 pb-4">
              -- 迭代开始：用户鉴权模块 --
            </div>
            {messages.map((msg) => (
              <TeamMessage key={msg.id} msg={msg} allAgents={allAgents} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* 输入区 - 广播给所有 Agents */}
        <div className="p-4 bg-[#161b22]/80 backdrop-blur-md border-t border-slate-800 shrink-0">
          <div className="max-w-3xl mx-auto">
            <div className="bg-[#0d1117] border border-slate-700 rounded-xl shadow-lg focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/50 transition-all overflow-hidden flex flex-col">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="@全体或指定Agent（如 @前端），指派任务、提需求或提供反馈..."
                className="w-full bg-transparent text-slate-200 p-3 min-h-[50px] max-h-[200px] resize-none outline-none text-sm placeholder:text-slate-600 font-medium"
                rows={2}
              />
              <div className="flex items-center justify-between px-3 py-2 bg-[#161b22] border-t border-slate-800/50">
                <div className="flex items-center gap-2">
                  <button className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-md transition-colors tooltip-trigger" title="附加文件 (PRD, 设计稿)">
                    <Paperclip size={16} />
                  </button>
                  <button className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1 rounded bg-slate-800/50 border border-slate-700/50">/命令</button>
                </div>
                <button 
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim()}
                  className={`flex items-center gap-1 px-4 py-1.5 rounded-md font-medium transition-all ${
                    inputValue.trim() 
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-500' 
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <span className="text-sm">派发任务</span>
                  <Send size={14} className="ml-1" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 右侧工作区 (IDE-like Workspace) */}
      {isWorkspaceOpen && (
        <aside className="w-[500px] bg-[#0d1117] border-l border-slate-800 flex flex-col flex-shrink-0 shadow-2xl animate-in slide-in-from-right-8 duration-300 z-20">
          <header className="h-10 border-b border-slate-800 flex items-center justify-between pr-2 pl-0 shrink-0 bg-[#161b22]">
            {/* 标签页风格 */}
            <div className="flex h-full">
              <button 
                onClick={() => setActiveTab('code')}
                className={`flex items-center gap-2 px-4 h-full border-r border-slate-800 text-sm font-medium transition-colors ${activeTab === 'code' ? 'bg-[#0d1117] text-slate-200 border-t-2 border-t-cyan-500' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 border-t-2 border-t-transparent'}`}
              >
                <Code2 size={14} className={activeTab === 'code' ? "text-cyan-400" : ""} />
                AuthForm.jsx
              </button>
              <button 
                onClick={() => setActiveTab('preview')}
                className={`flex items-center gap-2 px-4 h-full border-r border-slate-800 text-sm font-medium transition-colors ${activeTab === 'preview' ? 'bg-[#0d1117] text-slate-200 border-t-2 border-t-indigo-500' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 border-t-2 border-t-transparent'}`}
              >
                <Play size={14} className={activeTab === 'preview' ? "text-indigo-400" : ""} />
                UI 预览
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded transition-colors" title="全屏">
                <Maximize2 size={14} />
              </button>
              <button 
                onClick={() => setIsWorkspaceOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded transition-colors" title="收起"
              >
                <PanelRightClose size={14} />
              </button>
            </div>
          </header>
          
          <div className="flex-1 overflow-y-auto bg-[#0d1117]">
            {activeTab === 'code' ? (
              // 模拟代码编辑器
              <div className="font-mono text-sm p-4 text-slate-300 leading-relaxed overflow-x-auto">
                <div className="flex text-xs text-slate-500 mb-4 items-center gap-2">
                   <GitBranch size={12}/> <span className="text-cyan-400">前端 Agent</span> 提交于刚刚
                </div>
<pre className="text-[13px]">
<span className="text-pink-400">import</span> React <span className="text-pink-400">from</span> <span className="text-green-300">'react'</span>;<br/>
<br/>
<span className="text-pink-400">export default function</span> <span className="text-blue-300">AuthForm</span>() {'{'}<br/>
  <span className="text-pink-400">const</span> handleSubmit = (e) =&gt; {'{'}<br/>
    e.<span className="text-blue-300">preventDefault</span>();<br/>
    <span className="text-slate-500">// TODO: 等待后端 Agent 提供 API 接口</span><br/>
    console.<span className="text-blue-300">log</span>(<span className="text-green-300">'Login triggered'</span>);<br/>
  {'}'};<br/>
<br/>
  <span className="text-pink-400">return</span> (<br/>
    &lt;<span className="text-blue-400">div</span> <span className="text-cyan-200">className</span>=<span className="text-green-300">"min-h-screen flex items-center justify-center bg-gray-900"</span>&gt;<br/>
      &lt;<span className="text-blue-400">div</span> <span className="text-cyan-200">className</span>=<span className="text-green-300">"bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-700 w-96"</span>&gt;<br/>
        &lt;<span className="text-blue-400">h2</span> <span className="text-cyan-200">className</span>=<span className="text-green-300">"text-2xl font-bold text-white mb-6"</span>&gt;Welcome Back&lt;/<span className="text-blue-400">h2</span>&gt;<br/>
        &lt;<span className="text-blue-400">form</span> <span className="text-cyan-200">onSubmit</span>={'{'}handleSubmit{'}'} <span className="text-cyan-200">className</span>=<span className="text-green-300">"space-y-4"</span>&gt;<br/>
          &lt;<span className="text-blue-400">input</span> <span className="text-cyan-200">type</span>=<span className="text-green-300">"email"</span> <span className="text-cyan-200">placeholder</span>=<span className="text-green-300">"Email"</span> <span className="text-cyan-200">className</span>=<span className="text-green-300">"w-full bg-gray-900..."</span> /&gt;<br/>
          &lt;<span className="text-blue-400">input</span> <span className="text-cyan-200">type</span>=<span className="text-green-300">"password"</span> <span className="text-cyan-200">placeholder</span>=<span className="text-green-300">"Password"</span> <span className="text-cyan-200">className</span>=<span className="text-green-300">"w-full bg-gray-900..."</span> /&gt;<br/>
          &lt;<span className="text-blue-400">button</span> <span className="text-cyan-200">className</span>=<span className="text-green-300">"w-full bg-indigo-600 text-white p-2 rounded"</span>&gt;Sign In&lt;/<span className="text-blue-400">button</span>&gt;<br/>
        &lt;/<span className="text-blue-400">form</span>&gt;<br/>
      &lt;/<span className="text-blue-400">div</span>&gt;<br/>
    &lt;/<span className="text-blue-400">div</span>&gt;<br/>
  );<br/>
{'}'}
</pre>
              </div>
            ) : (
              // 模拟 UI 预览
              <div className="h-full w-full flex items-center justify-center bg-gray-900 relative">
                <div className="absolute top-4 right-4 flex gap-2">
                   <span className="px-2 py-1 bg-green-500/20 text-green-400 text-[10px] rounded border border-green-500/30 flex items-center gap-1"><RefreshCw size={10}/> 热更新就绪</span>
                </div>
                {/* 假装这里渲染了代码对应的UI */}
                <div className="bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-700 w-80 scale-90">
                  <h2 className="text-xl font-bold text-white mb-6 text-center">Welcome Back</h2>
                  <div className="space-y-4">
                    <input type="email" placeholder="Email address" disabled className="w-full bg-gray-900 border border-gray-700 text-gray-300 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 opacity-70" />
                    <input type="password" placeholder="Password" disabled className="w-full bg-gray-900 border border-gray-700 text-gray-300 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 opacity-70" />
                    <button disabled className="w-full text-white bg-indigo-600 hover:bg-indigo-700 font-medium rounded-lg text-sm px-5 py-2.5 text-center opacity-80">Sign In</button>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* 工作区底部状态栏 */}
          <div className="h-8 border-t border-slate-800 bg-[#161b22] flex items-center justify-between px-3 shrink-0 text-[11px] text-slate-500 font-mono">
            <div className="flex gap-4">
               <span className="flex items-center gap-1 hover:text-slate-300 cursor-pointer"><CheckCircle2 size={12} className="text-emerald-500"/> No errors</span>
               <span className="flex items-center gap-1 hover:text-slate-300 cursor-pointer"><Bug size={12} className="text-amber-500"/> 0 Warnings</span>
            </div>
            <div className="flex gap-3">
               <span>Ln 14, Col 5</span>
               <span>UTF-8</span>
               <span>React</span>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}

// 子组件：团队聊天消息气泡
function TeamMessage({ msg, allAgents }) {
  const isUser = msg.role === 'user';
  const [isProcessExpanded, setIsProcessExpanded] = useState(true);

  if (isUser) {
    return (
      <div className="flex gap-3 flex-row-reverse animate-in fade-in slide-in-from-bottom-2">
        <div className="w-8 h-8 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center shrink-0 mt-1">
          <User size={16} className="text-slate-300" />
        </div>
        <div className="flex flex-col items-end">
           <span className="text-[11px] text-slate-500 mb-1 mr-1">You (Architect)</span>
           <div className="bg-[#21262d] text-slate-200 p-3.5 rounded-2xl rounded-tr-none border border-slate-700/50 max-w-[85%] text-sm shadow-sm leading-relaxed">
             {msg.content}
           </div>
        </div>
      </div>
    );
  }

  // 获取对应 Agent 的信息
  const agentInfo = allAgents.find(a => a.id === msg.agentId) || { name: '未知 Agent', role: '系统', icon: Bot, color: 'text-slate-400', bg: 'bg-slate-800', border: 'border-slate-700' };
  const Icon = agentInfo.icon;

  return (
    <div className="flex gap-3 animate-in fade-in slide-in-from-bottom-2">
      <div className={`w-8 h-8 rounded-md ${agentInfo.bg} ${agentInfo.border} border flex items-center justify-center shrink-0 mt-1`}>
        <Icon size={16} className={agentInfo.color} />
      </div>
      <div className="flex flex-col gap-1.5 max-w-[85%] w-full">
        {/* Agent 名称与角色 */}
        <div className="flex items-baseline gap-2 ml-1">
          <span className={`text-xs font-semibold ${agentInfo.color}`}>{agentInfo.name}</span>
          <span className="text-[10px] text-slate-500">{agentInfo.role}</span>
        </div>
        
        {/* 如果正在输入中 */}
        {msg.isTyping ? (
          <div className="bg-[#161b22] border border-slate-800 p-3 rounded-2xl rounded-tl-none text-sm w-fit flex items-center gap-3">
             <Loader2 size={14} className={`${agentInfo.color} animate-spin`} />
             <span className="text-slate-400 italic text-xs">{msg.content}</span>
          </div>
        ) : (
          <>
            {/* Agent 思考/执行过程 */}
            {msg.plan && (
              <div className="bg-[#0d1117] border border-slate-800 rounded-lg overflow-hidden shadow-sm mt-1">
                <div 
                  className="px-3 py-1.5 bg-[#161b22] flex items-center justify-between cursor-pointer hover:bg-slate-800/50 transition-colors"
                  onClick={() => setIsProcessExpanded(!isProcessExpanded)}
                >
                  <div className="flex items-center gap-2 text-[11px] font-medium text-slate-400">
                    <Terminal size={12} className={agentInfo.color} />
                    执行任务 ({msg.plan.length} 步)
                  </div>
                  {isProcessExpanded ? <ChevronDown size={12} className="text-slate-500" /> : <ChevronRight size={12} className="text-slate-500" />}
                </div>
                
                {isProcessExpanded && (
                  <div className="p-2.5 border-t border-slate-800 text-[12px] space-y-2">
                    {msg.plan.map((step, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-slate-400">
                        {step.status === 'completed' ? (
                          <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                        ) : (
                          <Loader2 size={14} className={`${agentInfo.color} animate-spin mt-0.5 shrink-0`} />
                        )}
                        <span>{step.step}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 单个动作标签 (如果不是复杂plan) */}
            {msg.action && !msg.plan && (
              <div className="flex items-center gap-2 text-[11px] text-slate-500 ml-1">
                <CheckCircle2 size={12} className={agentInfo.color} />
                {msg.action.label}
              </div>
            )}

            {/* Agent 回复文本 */}
            <div className="bg-[#161b22] text-slate-300 p-3.5 rounded-2xl rounded-tl-none border border-slate-800 text-sm shadow-sm leading-relaxed">
              {/* 简单处理 @其他Agent 的高亮 */}
              {msg.content.split('(@后端 Agent)').map((part, i, arr) => 
                i === arr.length - 1 ? part : <span key={i}>{part}<span className="text-amber-400 bg-amber-400/10 px-1 rounded">@后端 Agent</span></span>
              )}
            </div>

            {/* 代码/产出物 提交卡片 */}
            {msg.hasArtifact && (
              <div className="mt-1 flex items-center justify-between p-2.5 bg-[#0d1117] border border-slate-700/50 rounded-lg w-72 hover:border-slate-600 transition-colors cursor-pointer group">
                <div className="flex items-center gap-3">
                  <div className={`bg-cyan-500/10 p-1.5 rounded border border-cyan-500/20`}>
                    <Code2 size={16} className="text-cyan-400" />
                  </div>
                  <div>
                    <div className="text-[13px] font-medium text-slate-200">{msg.artifactTitle}</div>
                    <div className="text-[10px] text-slate-500">已同步至工作区</div>
                  </div>
                </div>
                <button className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded transition-colors">
                  Review
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}