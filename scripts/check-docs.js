#!/usr/bin/env node

/**
 * 文档一致性检查脚本
 * 
 * 检查 CLAUDE.md 和 module-map.md 是否与实际代码结构一致
 * 
 * 用法: node scripts/check-docs.js
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = new URL('.', import.meta.url).pathname;

const PROJECT_ROOT = join(__dirname, '..');
const WORKSTATION_DIR = join(PROJECT_ROOT, 'frontend/src/components/devagents/workstation');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFileExists(filePath, description) {
  if (!existsSync(filePath)) {
    log('red', `❌ 缺少 ${description}: ${relative(PROJECT_ROOT, filePath)}`);
    return false;
  }
  log('green', `✅ ${description} 存在`);
  return true;
}

function getModules() {
  if (!existsSync(WORKSTATION_DIR)) {
    return [];
  }
  
  return readdirSync(WORKSTATION_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
}

function checkModuleIndex(moduleName) {
  const modulePath = join(WORKSTATION_DIR, moduleName);
  const indexFile = join(modulePath, 'index.ts');
  
  if (!existsSync(indexFile)) {
    log('yellow', `⚠️  模块 ${moduleName} 缺少 index.ts`);
    return false;
  }
  
  log('green', `✅ 模块 ${moduleName} 有 index.ts`);
  return true;
}

function checkClaudeMd() {
  log('cyan', '\n📚 检查 CLAUDE.md...');
  
  const claudeMdPath = join(PROJECT_ROOT, 'CLAUDE.md');
  if (!checkFileExists(claudeMdPath, 'CLAUDE.md')) {
    return false;
  }
  
  const content = readFileSync(claudeMdPath, 'utf-8');
  
  // 检查是否包含快速定位表
  if (!content.includes('快速定位表')) {
    log('red', '❌ CLAUDE.md 缺少快速定位表');
    return false;
  }
  log('green', '✅ CLAUDE.md 包含快速定位表');
  
  // 检查是否包含模块说明
  const modules = getModules();
  const missingModules = modules.filter(m => !content.includes(m));
  
  if (missingModules.length > 0) {
    log('yellow', `⚠️  CLAUDE.md 缺少模块说明: ${missingModules.join(', ')}`);
    return false;
  }
  log('green', '✅ CLAUDE.md 包含所有模块说明');
  
  return true;
}

function checkModuleMap() {
  log('cyan', '\n📊 检查 module-map.md...');
  
  const moduleMapPath = join(PROJECT_ROOT, 'docs/module-map.md');
  if (!checkFileExists(moduleMapPath, 'docs/module-map.md')) {
    return false;
  }
  
  const content = readFileSync(moduleMapPath, 'utf-8');
  
  // 检查是否包含模块关系图
  if (!content.includes('核心模块关系图')) {
    log('red', '❌ module-map.md 缺少核心模块关系图');
    return false;
  }
  log('green', '✅ module-map.md 包含核心模块关系图');
  
  // 检查是否包含依赖矩阵
  if (!content.includes('模块依赖矩阵')) {
    log('red', '❌ module-map.md 缺少模块依赖矩阵');
    return false;
  }
  log('green', '✅ module-map.md 包含模块依赖矩阵');
  
  return true;
}

function checkModulesIndex() {
  log('cyan', '\n📦 检查模块 index.ts...');
  
  const modules = getModules();
  let allGood = true;
  
  for (const module of modules) {
    if (!checkModuleIndex(module)) {
      allGood = false;
    }
  }
  
  return allGood;
}

function main() {
  log('cyan', '🔍 开始检查文档一致性...\n');
  
  const results = {
    claudeMd: checkClaudeMd(),
    moduleMap: checkModuleMap(),
    modulesIndex: checkModulesIndex(),
  };
  
  log('cyan', '\n📋 检查结果汇总...');
  console.log('─'.repeat(50));
  
  const allPassed = Object.values(results).every(Boolean);
  
  if (allPassed) {
    log('green', '\n✅ 所有检查通过！');
    process.exit(0);
  } else {
    log('red', '\n❌ 部分检查失败，请修复后重试');
    process.exit(1);
  }
}

main();
