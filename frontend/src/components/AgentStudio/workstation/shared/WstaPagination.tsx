import { Pagination } from 'antd';
import type { PaginationProps } from 'antd';

const zhCN = {
  jump_to: '跳至',
  page: '页',
};

interface WstaPaginationProps extends Omit<PaginationProps, 'size' | 'showTotal'> {
  total: number;
  current: number;
  pageSize: number;
  onChange: (page: number, pageSize: number) => void;
  /** 嵌入卡片：紧凑 padding + 上边框分隔（默认整页布局，带大底边距） */
  embedded?: boolean;
  /** 左侧「共 N 条」计数（嵌入卡片且卡片头部已展示总数时可关） */
  showCount?: boolean;
}

export default function WstaPagination({
  total,
  current,
  pageSize,
  onChange,
  embedded = false,
  showCount = true,
  ...rest
}: WstaPaginationProps) {
  if (total === 0) return null;
  return (
    <div
      className={
        embedded
          ? 'flex items-center justify-between gap-4 px-4 py-3 border-t border-[var(--color-border)]'
          : 'flex items-center justify-between px-6 pt-3 gap-4'
      }
      style={embedded ? undefined : { paddingBottom: 40 }}
    >
      {showCount && (
        <span className="text-[14px] text-[var(--color-text-muted)] tabular-nums whitespace-nowrap font-medium">
          共 {total} 条
        </span>
      )}
      <Pagination
        current={current}
        pageSize={pageSize}
        total={total}
        onChange={onChange}
        showSizeChanger={false}
        showQuickJumper
        showLessItems
        locale={zhCN}
        {...rest}
      />
    </div>
  );
}
