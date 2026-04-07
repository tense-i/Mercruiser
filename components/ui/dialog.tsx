'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function Dialog({ open, onClose, title, description, children, size = 'md', className }: DialogProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-3xl',
  };

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div
        className={cn(
          'relative z-10 w-full rounded-3xl border border-zinc-800/80 shadow-2xl shadow-black/60 animate-scale-in',
          sizeClasses[size],
          className,
        )}
        style={{
          background: 'linear-gradient(160deg, rgba(22,22,28,0.98) 0%, rgba(16,16,20,0.99) 100%)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
      >
        <div
          className="flex items-start justify-between px-6 py-5"
          style={{ borderBottom: '1px solid rgba(63,63,70,0.45)' }}
        >
          <div>
            <h2 className="text-[17px] font-bold text-zinc-50">{title}</h2>
            {description ? <p className="mt-1 text-sm leading-relaxed text-zinc-500">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-4 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-xl text-zinc-600 transition-all duration-150 hover:bg-zinc-800 hover:text-zinc-300"
            style={{ border: '1px solid rgba(63,63,70,0.5)' }}
          >
            <X size={15} />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto p-6 custom-scrollbar">{children}</div>
      </div>
    </div>
  );
}

interface DialogFooterProps {
  children: React.ReactNode;
}

export function DialogFooter({ children }: DialogFooterProps) {
  return <div className="mt-6 flex items-center justify-end gap-3">{children}</div>;
}

interface DialogFieldProps {
  label: string;
  children: React.ReactNode;
  hint?: string;
}

export function DialogField({ label, children, hint }: DialogFieldProps) {
  return (
    <div>
      <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">{label}</label>
      {children}
      {hint ? <p className="mt-1.5 text-xs text-zinc-600">{hint}</p> : null}
    </div>
  );
}

interface DialogSectionProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function DialogSection({ title, children, className }: DialogSectionProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {title ? <div className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">{title}</div> : null}
      {children}
    </div>
  );
}

export function DialogDivider() {
  return <div className="my-5 border-t border-zinc-800" />;
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  children: React.ReactNode;
}

export function DialogButton({ variant = 'secondary', loading, children, disabled, className, ...props }: ButtonProps) {
  const variantClasses = {
    primary: 'bg-brand-600 text-white hover:bg-brand-500 shadow-lg shadow-brand-600/20 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:shadow-none',
    secondary: 'border border-zinc-700 bg-zinc-900 text-zinc-100 hover:border-zinc-600 hover:bg-zinc-800 disabled:opacity-50',
    ghost: 'text-zinc-400 hover:text-zinc-200 disabled:opacity-40',
    danger: 'bg-rose-600/20 border border-rose-500/30 text-rose-300 hover:bg-rose-600/30 disabled:opacity-50',
  };

  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cn(
        'flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all active:scale-95',
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
      {children}
    </button>
  );
}
