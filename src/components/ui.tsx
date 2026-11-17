import { useEffect, useId, useRef, type ReactNode } from 'react';

export function Section({ title, footer, children }: { title?: string; footer?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      {title ? <h2 className="section-label">{title}</h2> : null}
      <div className="group">{children}</div>
      {footer ? <div className="section-foot">{footer}</div> : null}
    </section>
  );
}

export function ScreenHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="screen-header">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function Switch({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="switch-row">
      <span id={id}>{label}</span>
      <button
        type="button"
        className="switch"
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
    </div>
  );
}

export function Stepper({
  value,
  min,
  max,
  label,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  label: string;
  onChange: (next: number) => void;
}) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" aria-label={`Decrease ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)}>
        −
      </button>
      <output>{value}</output>
      <button type="button" aria-label={`Increase ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  );
}

export type ConfirmAction = {
  label: string;
  tone?: 'primary' | 'danger';
  onClick: () => void;
};

export type ConfirmRequest = {
  title: string;
  message?: string;
  actions: ConfirmAction[];
};

export function ActionSheet({ request, onClose }: { request: ConfirmRequest; onClose: () => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet-stack"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-card">
          <h2 id="confirm-title">{request.title}</h2>
          {request.message ? <p>{request.message}</p> : null}
          {request.actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={`sheet-action ${action.tone ?? ''}`}
              onClick={() => {
                onClose();
                action.onClick();
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
        <button ref={cancelRef} type="button" className="sheet-cancel" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
