import type { ReactNode } from 'react';

type IconProps = { className?: string };

function Svg({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="none">
      {children}
    </svg>
  );
}

export function IconList({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M5 7h14M5 12h14M5 17h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function IconCalendar({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="4" y="5" width="16" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 3.5v3M16 3.5v3M4 9.5h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function IconSpend({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M5 19V10M12 19V5M19 19v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function IconSettings({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 8h16M4 16h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="9" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="15" cy="16" r="2.2" stroke="currentColor" strokeWidth="1.8" />
    </Svg>
  );
}

export function IconPlus({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </Svg>
  );
}

export function IconChevron({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M14.5 5.5 8 12l6.5 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
