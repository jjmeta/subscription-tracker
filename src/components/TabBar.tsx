import { IconCalendar, IconList, IconSettings, IconSpend } from './icons';
import { navigate, type Route } from '../router';

const tabs: { route: Route; label: string; icon: typeof IconList }[] = [
  { route: { name: 'list' }, label: 'Subs', icon: IconList },
  { route: { name: 'upcoming' }, label: 'Upcoming', icon: IconCalendar },
  { route: { name: 'spend' }, label: 'Spend', icon: IconSpend },
  { route: { name: 'settings' }, label: 'Settings', icon: IconSettings },
];

export function TabBar({ current, dueCount }: { current: Route['name']; dueCount: number }) {
  return (
    <nav className="tabbar" aria-label="Sections">
      {tabs.map((tab) => {
        const active = current === tab.route.name;
        const Icon = tab.icon;
        const label = tab.route.name === 'upcoming' && dueCount > 0 ? `Upcoming, ${dueCount} due soon` : tab.label;
        return (
          <button
            key={tab.label}
            type="button"
            className="tab"
            aria-current={active ? 'page' : undefined}
            aria-label={label}
            onClick={() => navigate(tab.route)}
          >
            <Icon />
            <span>{tab.label}</span>
            {tab.route.name === 'upcoming' && dueCount > 0 ? <span className="tab-badge">{dueCount}</span> : null}
          </button>
        );
      })}
    </nav>
  );
}
