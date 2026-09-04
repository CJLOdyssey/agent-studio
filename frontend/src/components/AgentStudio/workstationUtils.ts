import type { ProjectRun } from '../../types';

// run 树工具：与 ragbase useHomeState 一致 — 目标 run 的父链 + 主子孙链，
// 分支切换视图整体加载目标分支全部消息（不在该分支的轮次仅视图隐藏，DB 留存）。
export function buildRunPath(
  runs: ProjectRun[],
  fromRunId?: string | null,
): {
  path: ProjectRun[];
  active: string | null;
} {
  const byId = new Map(runs.map((r) => [r.id, r]));
  const latest = runs.reduce(
    (a, b) =>
      (b.created_at ?? '').localeCompare(a.created_at ?? '') > 0 ? b : a,
    runs[0],
  );
  const start = fromRunId && byId.has(fromRunId) ? byId.get(fromRunId) : latest;
  const path: ProjectRun[] = [];
  const seen = new Set<string>();
  let cur: ProjectRun | undefined = start;
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    path.unshift(cur);
    cur = cur.parent_run_id ? byId.get(cur.parent_run_id) : undefined;
  }
  return { path, active: start?.id ?? latest?.id ?? null };
}

// 分支完整路径：目标 run 的父链（根在前）+ 主子孙链（每次取子分支，优先
// 选非当前视图所在分支，全部都在当前分支则取最新）。切分支后显示该分支的
// 全部消息，后续轮次跟随目标分支。
export function buildBranchPath(
  runs: ProjectRun[],
  fromRunId: string,
  excludeRunIds: Set<string>,
): ProjectRun[] {
  const { path: parentPath } = buildRunPath(runs, fromRunId);
  const byParent = new Map<string, ProjectRun[]>();
  for (const r of runs) {
    const p = r.parent_run_id;
    if (!p) continue;
    const list = byParent.get(p);
    if (list) list.push(r);
    else byParent.set(p, [r]);
  }
  const tail: ProjectRun[] = [];
  const seen = new Set<string>(parentPath.map((r) => r.id));
  let cur: string | null = fromRunId;
  while (cur) {
    const kids: ProjectRun[] = (byParent.get(cur) ?? [])
      .filter((k) => !seen.has(k.id))
      .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
    const next: ProjectRun | undefined =
      kids.find((k) => !excludeRunIds.has(k.id)) ?? kids[0];
    if (!next) break;
    tail.push(next);
    seen.add(next.id);
    cur = next.id;
  }
  return [...parentPath, ...tail];
}
