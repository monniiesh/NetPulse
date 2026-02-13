'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Clock, AlertTriangle, FileText, Settings, Cpu, Bell } from 'lucide-react';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/history', icon: Clock, label: 'History' },
  { href: '/anomalies', icon: AlertTriangle, label: 'Anomalies' },
  { href: '/reports', icon: FileText, label: 'Reports' },
];

const settingsItems = [
  { href: '/settings/probes', icon: Cpu, label: 'Probes' },
  { href: '/settings/alerts', icon: Bell, label: 'Alerts' },
];

export function Sidebar() {
  const pathname = usePathname();
  const isSettingsActive = pathname?.startsWith('/settings');

  return (
    <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-white">NetPulse</h1>
      </div>
      <nav className="flex-1 px-4 space-y-1">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
              }`}
            >
              <Icon size={20} />
              <span className="font-medium">{label}</span>
            </Link>
          );
        })}

        {/* Settings section */}
        <div className={`flex items-center gap-3 px-4 py-3 rounded-lg ${
          isSettingsActive ? 'text-white' : 'text-gray-400'
        }`}>
          <Settings size={20} />
          <span className="font-medium">Settings</span>
        </div>
        <div className="ml-4 space-y-1">
          {settingsItems.map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-sm ${
                  isActive
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                }`}
              >
                <Icon size={16} />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}
