import type { ColumnSort, RowData } from '@tanstack/react-table';

export type FilterVariant = 'text' | 'date' | 'dateRange' | 'select' | 'multiSelect';

declare module '@tanstack/react-table' {
  interface ColumnMeta<TData extends RowData, TValue> {
    label?: string;
    placeholder?: string;
    variant?: FilterVariant;
    options?: Option[];
    icon?: React.FC<React.SVGProps<SVGSVGElement>>;
  }
}

export interface Option {
  label: string;
  value: string;
  count?: number;
  icon?: React.FC<React.SVGProps<SVGSVGElement>>;
}

export interface ExtendedColumnSort<TData> extends Omit<ColumnSort, 'id'> {
  id: Extract<keyof TData, string>;
}
