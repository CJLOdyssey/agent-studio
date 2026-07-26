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
  onChange: (page: number) => void;
}

export default function WstaPagination({
  total,
  current,
  pageSize,
  onChange,
  ...rest
}: WstaPaginationProps) {
  if (total === 0) return null;
  return (
    <div className="flex items-center justify-between px-6 pt-3 gap-4" style={{ paddingBottom: 40 }}>
      <span className="text-[14px] text-[var(--color-text-muted)] tabular-nums whitespace-nowrap font-medium">
        共 {total} 条
      </span>
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
