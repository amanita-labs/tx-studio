// src/components/known-label-highlight.tsx
'use client';

import { type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { KnownLabelEntry, type TransactionLabelCategory } from '@/lib/labels';
import { cn } from '@/lib/utils';

type CategoryTheme = {
  title: string;
  containerClass: string;
  badgeClass: string;
  nameClass: string;
  descriptionClass: string;
  linkClass: string;
};

const CATEGORY_THEMES: Record<TransactionLabelCategory, CategoryTheme> = {
  script: {
    title: 'Known Script',
    containerClass: 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40',
    badgeClass: 'bg-emerald-600/10 text-emerald-700 hover:bg-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200',
    nameClass: 'text-emerald-800 dark:text-emerald-100',
    descriptionClass: 'text-emerald-700/80 dark:text-emerald-200/80',
    linkClass: 'text-emerald-700 hover:text-emerald-800 dark:text-emerald-200 dark:hover:text-emerald-100',
  },
  address: {
    title: 'Known Address',
    containerClass: 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40',
    badgeClass: 'bg-blue-600/10 text-blue-700 hover:bg-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200',
    nameClass: 'text-blue-800 dark:text-blue-100',
    descriptionClass: 'text-blue-700/80 dark:text-blue-200/80',
    linkClass: 'text-blue-700 hover:text-blue-800 dark:text-blue-200 dark:hover:text-blue-100',
  },
  'payment-cred': {
    title: 'Known Payment Key',
    containerClass: 'border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-950/40',
    badgeClass: 'bg-purple-600/10 text-purple-700 hover:bg-purple-500/20 dark:bg-purple-500/10 dark:text-purple-200',
    nameClass: 'text-purple-800 dark:text-purple-100',
    descriptionClass: 'text-purple-700/80 dark:text-purple-200/80',
    linkClass: 'text-purple-700 hover:text-purple-800 dark:text-purple-200 dark:hover:text-purple-100',
  },
  'stake-cred': {
    title: 'Known Stake Key',
    containerClass: 'border-sky-200 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/40',
    badgeClass: 'bg-sky-600/10 text-sky-700 hover:bg-sky-500/20 dark:bg-sky-500/10 dark:text-sky-200',
    nameClass: 'text-sky-800 dark:text-sky-100',
    descriptionClass: 'text-sky-700/80 dark:text-sky-200/80',
    linkClass: 'text-sky-700 hover:text-sky-800 dark:text-sky-200 dark:hover:text-sky-100',
  },
  drep: {
    title: 'Known DRep',
    containerClass: 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40',
    badgeClass: 'bg-amber-600/10 text-amber-700 hover:bg-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200',
    nameClass: 'text-amber-800 dark:text-amber-100',
    descriptionClass: 'text-amber-700/80 dark:text-amber-200/80',
    linkClass: 'text-amber-700 hover:text-amber-800 dark:text-amber-200 dark:hover:text-amber-100',
  },
  cc: {
    title: 'Known Committee',
    containerClass: 'border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40',
    badgeClass: 'bg-rose-600/10 text-rose-700 hover:bg-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200',
    nameClass: 'text-rose-800 dark:text-rose-100',
    descriptionClass: 'text-rose-700/80 dark:text-rose-200/80',
    linkClass: 'text-rose-700 hover:text-rose-800 dark:text-rose-200 dark:hover:text-rose-100',
  },
  pool: {
    title: 'Known Pool',
    containerClass: 'border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/40',
    badgeClass: 'bg-indigo-600/10 text-indigo-700 hover:bg-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-200',
    nameClass: 'text-indigo-800 dark:text-indigo-100',
    descriptionClass: 'text-indigo-700/80 dark:text-indigo-200/80',
    linkClass: 'text-indigo-700 hover:text-indigo-800 dark:text-indigo-200 dark:hover:text-indigo-100',
  },
};

type KnownLabelHighlightProps = {
  category: TransactionLabelCategory;
  label: KnownLabelEntry;
  className?: string;
  children?: ReactNode;
};

export function KnownLabelHighlight({ category, label, className, children }: KnownLabelHighlightProps) {
  const theme = CATEGORY_THEMES[category];

  return (
    <div
      className={cn(
        'rounded-md border px-3 py-2 text-xs',
        theme.containerClass,
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className={theme.badgeClass}>
          {theme.title}
        </Badge>
        <span className={cn('font-medium', theme.nameClass)}>{label.name}</span>
      </div>
      {label.description && (
        <p className={cn('mt-1 text-[11px] leading-snug', theme.descriptionClass)}>
          {label.description}
        </p>
      )}
      {label.url && (
        <a
          href={label.url}
          target="_blank"
          rel="noreferrer"
          className={cn(
            'mt-1 inline-flex text-[11px] font-medium underline',
            theme.linkClass,
          )}
        >
          Reference
        </a>
      )}
      {children && (
        <div className="mt-2 space-y-2">
          {children}
        </div>
      )}
    </div>
  );
}
