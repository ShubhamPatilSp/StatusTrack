'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Briefcase, ShieldAlert } from 'lucide-react';

const navItems = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/dashboard/services', label: 'Manage Services', icon: Briefcase },
  // { href: '/admin/dashboard/incidents', label: 'Manage Incidents', icon: ShieldAlert },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="z-20 hidden w-64 overflow-y-auto bg-white dark:bg-gray-800 md:block flex-shrink-0">
      <div className="py-4 text-gray-500 dark:text-gray-400">
        <Link href="/admin/dashboard" className="ml-6 text-lg font-bold text-gray-800 dark:text-gray-200">
          StatusPage
        </Link>
        <ul className="mt-6">
          {navItems.map((item) => (
            <li className="relative px-6 py-3" key={item.label}>
              <Link
                href={item.href}
                className={`inline-flex items-center w-full text-sm font-semibold transition-colors duration-150 hover:text-gray-800 dark:hover:text-gray-200 ${
                  pathname.startsWith(item.href) && item.href !== '/admin/dashboard' || pathname === item.href ? 'text-gray-800 dark:text-gray-100' : ''
                }`}
              >
                {(pathname.startsWith(item.href) && item.href !== '/admin/dashboard' || pathname === item.href) && (
                  <span
                    className="absolute inset-y-0 left-0 w-1 bg-blue-600 rounded-tr-lg rounded-br-lg"
                    aria-hidden="true"
                  ></span>
                )}
                <item.icon className="w-5 h-5" />
                <span className="ml-4">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
