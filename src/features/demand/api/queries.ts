import { queryOptions } from '@tanstack/react-query';
import { getDemandReport, getUnansweredQuestions } from './service';
import type { DemandPeriod } from './types';

export const demandKeys = {
  all: ['demand'] as const,
  report: (days: DemandPeriod) => [...demandKeys.all, 'report', days] as const,
  questions: () => [...demandKeys.all, 'questions'] as const
};

export const demandReportOptions = (days: DemandPeriod) =>
  queryOptions({ queryKey: demandKeys.report(days), queryFn: () => getDemandReport(days) });

export const unansweredQuestionsOptions = () =>
  queryOptions({ queryKey: demandKeys.questions(), queryFn: () => getUnansweredQuestions() });
