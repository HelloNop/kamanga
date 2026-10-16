import React from 'react';
import { Heading } from '../ui/heading';

export default function PageContainer({
  children,
  pageTitle,
  pageDescription,
  pageHeaderAction
}: {
  children: React.ReactNode;
  pageTitle?: string;
  pageDescription?: string;
  pageHeaderAction?: React.ReactNode;
}) {
  const hasHeader = pageTitle || pageHeaderAction;

  return (
    <div className='bg-muted flex flex-1 flex-col rounded-3xl p-4 md:p-[26px]'>
      {hasHeader && (
        <div className='mb-[22px] flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4'>
          <Heading title={pageTitle ?? ''} description={pageDescription ?? ''} />
          {pageHeaderAction && (
            <div className='flex shrink-0 flex-wrap gap-2'>{pageHeaderAction}</div>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
