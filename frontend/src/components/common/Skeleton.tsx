import type { ReactNode } from 'react';

type Variant = 'line' | 'card' | 'list' | 'table' | 'chart' | 'avatar';

interface SkeletonProps {
  variant?: Variant;
  rows?: number;
  className?: string;
  children?: ReactNode;
}

const base = 'animate-pulse bg-slate-200/70 rounded';

export default function Skeleton({
  variant = 'line',
  rows = 3,
  className = '',
  children,
}: SkeletonProps) {
  if (variant === 'line') {
    return <div className={`${base} h-3 ${className || 'w-full'}`} aria-hidden>{children}</div>;
  }

  if (variant === 'avatar') {
    return <div className={`${base} h-10 w-10 rounded-full ${className}`} aria-hidden />;
  }

  if (variant === 'card') {
    return (
      <div
        className={`rounded-xl border border-slate-200 bg-white p-4 space-y-3 ${className}`}
        role="status"
        aria-label="불러오는 중"
        aria-live="polite"
      >
        <div className={`${base} h-4 w-1/3`} />
        <div className={`${base} h-3 w-full`} />
        <div className={`${base} h-3 w-2/3`} />
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div
        className={`space-y-3 ${className}`}
        role="status"
        aria-label="불러오는 중"
        aria-live="polite"
      >
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-white border border-slate-100">
            <div className={`${base} h-9 w-9 rounded-full`} />
            <div className="flex-1 space-y-2">
              <div className={`${base} h-3 w-1/3`} />
              <div className={`${base} h-2.5 w-2/3`} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div
        className={`rounded-xl border border-slate-200 overflow-hidden ${className}`}
        role="status"
        aria-label="불러오는 중"
        aria-live="polite"
      >
        <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
          <div className={`${base} h-3 w-24`} />
        </div>
        <div className="divide-y divide-slate-100">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <div className={`${base} h-3 w-1/6`} />
              <div className={`${base} h-3 w-1/4`} />
              <div className={`${base} h-3 w-1/5`} />
              <div className={`${base} h-3 w-1/6 ml-auto`} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // chart
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-5 ${className}`}
      role="status"
      aria-label="불러오는 중"
      aria-live="polite"
    >
      <div className={`${base} h-4 w-32 mb-4`} />
      <div className="flex items-end gap-2 h-48">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className={`${base} flex-1`}
            style={{ height: `${30 + (i * 8) % 60}%` }}
          />
        ))}
      </div>
    </div>
  );
}
