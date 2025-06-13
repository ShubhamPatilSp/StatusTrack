import React from 'react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
      <main className="h-full">
        {children}
      </main>
    </div>
  );
}
