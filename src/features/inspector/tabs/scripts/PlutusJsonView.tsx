'use client';

import React, { ReactNode } from 'react';

const INDENT_PX = 16;

const Punct = ({ children }: { children: ReactNode }) => (
  <span className="text-muted-foreground">{children}</span>
);
const KeyTok = ({ children }: { children: ReactNode }) => (
  <span className="text-rose-500 dark:text-rose-400">{children}</span>
);
const NumTok = ({ children }: { children: ReactNode }) => (
  <span className="text-blue-500 dark:text-blue-400">{children}</span>
);
const StrTok = ({ children }: { children: ReactNode }) => (
  <span className="text-emerald-600 dark:text-emerald-400">&quot;{children}&quot;</span>
);

function Line({ indent, children }: { indent: number; children: ReactNode }) {
  return (
    <div style={{ paddingLeft: indent * INDENT_PX }} className="whitespace-pre-wrap break-all">
      {children}
    </div>
  );
}

function inline(value: unknown): ReactNode {
  if (value === null) return <span className="text-muted-foreground">null</span>;
  if (typeof value === 'number') return <NumTok>{value}</NumTok>;
  if (typeof value === 'bigint') return <NumTok>{String(value)}</NumTok>;
  if (typeof value === 'boolean') return <NumTok>{String(value)}</NumTok>;
  if (typeof value === 'string') return <StrTok>{value}</StrTok>;
  return <span className="text-muted-foreground">{String(value)}</span>;
}

function emitValue(
  value: unknown,
  indent: number,
  suffix: string,
  keyPrefix: string
): ReactNode[] {
  if (value === null || typeof value !== 'object') {
    return [
      <Line key={keyPrefix} indent={indent}>
        {inline(value)}
        <Punct>{suffix}</Punct>
      </Line>,
    ];
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return [
        <Line key={keyPrefix} indent={indent}>
          <Punct>{`[]${suffix}`}</Punct>
        </Line>,
      ];
    }
    const out: ReactNode[] = [
      <Line key={`${keyPrefix}-o`} indent={indent}>
        <Punct>[</Punct>
      </Line>,
    ];
    value.forEach((it, i) => {
      out.push(...emitValue(it, indent + 1, i < value.length - 1 ? ',' : '', `${keyPrefix}-${i}`));
    });
    out.push(
      <Line key={`${keyPrefix}-c`} indent={indent}>
        <Punct>{`]${suffix}`}</Punct>
      </Line>
    );
    return out;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) {
    return [
      <Line key={keyPrefix} indent={indent}>
        <Punct>{`{}${suffix}`}</Punct>
      </Line>,
    ];
  }
  const out: ReactNode[] = [
    <Line key={`${keyPrefix}-o`} indent={indent}>
      <Punct>{'{'}</Punct>
    </Line>,
  ];
  entries.forEach(([k, v], i) => {
    out.push(
      ...emitField(k, v, indent + 1, i < entries.length - 1 ? ',' : '', `${keyPrefix}-${k}`)
    );
  });
  out.push(
    <Line key={`${keyPrefix}-c`} indent={indent}>
      <Punct>{`}${suffix}`}</Punct>
    </Line>
  );
  return out;
}

function emitField(
  key: string,
  val: unknown,
  indent: number,
  suffix: string,
  keyPrefix: string
): ReactNode[] {
  if (val === null || typeof val !== 'object') {
    return [
      <Line key={keyPrefix} indent={indent}>
        <KeyTok>{key}</KeyTok>
        <Punct>: </Punct>
        {inline(val)}
        <Punct>{suffix}</Punct>
      </Line>,
    ];
  }
  if (Array.isArray(val)) {
    if (val.length === 0) {
      return [
        <Line key={keyPrefix} indent={indent}>
          <KeyTok>{key}</KeyTok>
          <Punct>{`: []${suffix}`}</Punct>
        </Line>,
      ];
    }
    const out: ReactNode[] = [
      <Line key={`${keyPrefix}-o`} indent={indent}>
        <KeyTok>{key}</KeyTok>
        <Punct>: [</Punct>
      </Line>,
    ];
    val.forEach((it, i) => {
      out.push(...emitValue(it, indent + 1, i < val.length - 1 ? ',' : '', `${keyPrefix}-${i}`));
    });
    out.push(
      <Line key={`${keyPrefix}-c`} indent={indent}>
        <Punct>{`]${suffix}`}</Punct>
      </Line>
    );
    return out;
  }
  const entries = Object.entries(val as Record<string, unknown>);
  if (entries.length === 0) {
    return [
      <Line key={keyPrefix} indent={indent}>
        <KeyTok>{key}</KeyTok>
        <Punct>{`: {}${suffix}`}</Punct>
      </Line>,
    ];
  }
  const out: ReactNode[] = [
    <Line key={`${keyPrefix}-o`} indent={indent}>
      <KeyTok>{key}</KeyTok>
      <Punct>{': {'}</Punct>
    </Line>,
  ];
  entries.forEach(([k, v], i) => {
    out.push(
      ...emitField(k, v, indent + 1, i < entries.length - 1 ? ',' : '', `${keyPrefix}-${k}`)
    );
  });
  out.push(
    <Line key={`${keyPrefix}-c`} indent={indent}>
      <Punct>{`}${suffix}`}</Punct>
    </Line>
  );
  return out;
}

export function PlutusJsonView({ data, className = '' }: { data: unknown; className?: string }) {
  return (
    <div className={`text-xs font-mono ${className}`}>
      {emitValue(data, 0, '', 'root')}
    </div>
  );
}
