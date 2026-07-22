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
  return (
    <div className="wsta-pagination">
      <span className="wsta-pagination-info">
        共 {total} 条
      </span>
      <Pagination
        current={current}
        pageSize={pageSize}
        total={total}
        onChange={onChange}
        size="small"
        showSizeChanger={false}
        showQuickJumper
        showLessItems
        locale={zhCN}
        {...rest}
      />
    </div>
  );
}
