// src/components/known-label-highlight.tsx
'use client';

import { type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { KnownLabelEntry } from '@/lib/labels';
import { cn } from '@/lib/utils';

type KnownLabelCategory = 'script' | 'address' | 'signer';

type CategoryTheme = {
  title: string;
  containerClass: string;
  badgeClass: string;
  nameClass: string;
  descriptionClass: string;
  linkClass: string;
};

const CATEGORY_THEMES: Record<KnownLabelCategory, CategoryTheme> = {
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
  signer: {
    title: 'Known Signer',
    containerClass: 'border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-950/40',
    badgeClass: 'bg-purple-600/10 text-purple-700 hover:bg-purple-500/20 dark:bg-purple-500/10 dark:text-purple-200',
    nameClass: 'text-purple-800 dark:text-purple-100',
    descriptionClass: 'text-purple-700/80 dark:text-purple-200/80',
    linkClass: 'text-purple-700 hover:text-purple-800 dark:text-purple-200 dark:hover:text-purple-100',
  },
};

type KnownLabelHighlightProps = {
  category: KnownLabelCategory;
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

