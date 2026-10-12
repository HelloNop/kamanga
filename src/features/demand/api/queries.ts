import { queryOptions } from '@tanstack/react-query';
import { getDemandReport } from './service';
import type { DemandPeriod } from './types';

export const demandKeys = {
  all: ['demand'] as const,
  report: (days: DemandPeriod) => [...demandKeys.all, 'report', days] as const
};

export const demandReportOptions = (days: DemandPeriod) =>
  queryOptions({ queryKey: demandKeys.report(days), queryFn: () => getDemandReport(days) });
