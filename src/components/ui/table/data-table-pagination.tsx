import type { Table } from '@tanstack/react-table';
import { Icons } from '@/components/icons';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface DataTablePaginationProps<TData> extends React.ComponentProps<'div'> {
  table: Table<TData>;
  totalRows?: number;
  pageSizeOptions?: number[];
}

/** Nomor halaman dengan "…": 1 … 4 5 [6] 7 8 … 74 */
export function pageList(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, current - 1, current, current + 1]);
  if (current <= 3) [2, 3, 4].forEach((n) => set.add(n));
  if (current >= total - 2) [total - 3, total - 2, total - 1].forEach((n) => set.add(n));
  const sorted = [...set].filter((n) => n >= 1 && n <= total).toSorted((a, b) => a - b);
  const out: (number | '…')[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push('…');
    out.push(n);
  });
  return out;
}

const pageBtn =
  'grid size-[34px] place-items-center rounded-[10px] border text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40';

export function DataTablePagination<TData>({
  table,
  totalRows,
  pageSizeOptions = [10, 20, 30, 40, 50],
  className,
  ...props
}: DataTablePaginationProps<TData>) {
  const current = table.getState().pagination.pageIndex + 1;
  const pages = table.getPageCount();
  const selected = table.getFilteredSelectedRowModel().rows.length;
  const total = totalRows ?? table.getFilteredRowModel().rows.length;

  return (
    <div
      className={cn(
        'text-muted-foreground flex w-full flex-wrap items-center justify-between gap-3 text-[0.8125rem]',
        className
      )}
      {...props}
    >
      <div className='whitespace-nowrap'>
        {selected > 0
          ? `${selected} dari ${total.toLocaleString('id-ID')} data dipilih.`
          : `Total ${total.toLocaleString('id-ID')} data`}
      </div>
      <div className='flex items-center gap-4'>
        <div className='hidden items-center gap-2 sm:flex'>
          <span className='whitespace-nowrap'>Baris</span>
          <Select
            value={`${table.getState().pagination.pageSize}`}
            onValueChange={(value) => table.setPageSize(Number(value))}
          >
            <SelectTrigger
              aria-label='Baris per halaman'
              className='h-[34px] w-[4.5rem] rounded-[10px] [&[data-size]]:h-[34px]'
            >
              <SelectValue placeholder={table.getState().pagination.pageSize} />
            </SelectTrigger>
            <SelectContent side='top'>
              <SelectGroup>
                {pageSizeOptions.map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <nav aria-label='Halaman' className='flex items-center gap-1.5'>
          <button
            type='button'
            aria-label='Halaman sebelumnya'
            className={cn(pageBtn, 'bg-card hover:bg-muted')}
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <Icons.chevronLeft className='size-4' />
          </button>
          {pageList(current, Math.max(pages, 1)).map((p, i) =>
            p === '…' ? (
              <span
                key={`gap-${i}`}
                aria-hidden='true'
                className='grid size-[34px] place-items-center'
              >
                …
              </span>
            ) : (
              <button
                key={p}
                type='button'
                aria-label={`Halaman ${p}`}
                aria-current={p === current ? 'page' : undefined}
                className={cn(
                  pageBtn,
                  p === current
                    ? 'border-transparent bg-primary font-semibold text-primary-foreground'
                    : 'bg-card hover:bg-muted'
                )}
                onClick={() => table.setPageIndex(p - 1)}
              >
                {p}
              </button>
            )
          )}
          <button
            type='button'
            aria-label='Halaman berikutnya'
            className={cn(pageBtn, 'bg-card hover:bg-muted')}
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <Icons.chevronRight className='size-4' />
          </button>
        </nav>
      </div>
    </div>
  );
}
