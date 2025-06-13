"use client";

export function OrganizationSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm animate-pulse p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
          <div className="h-3 w-48 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
        <div className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
      </div>
      <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
    </div>
  );
}
