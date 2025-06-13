"use client";

import Link from "next/link";
import { Organization } from "@/types";
import { ShieldCheck } from "lucide-react";

interface OrganizationCardProps {
  organization: Organization;
}

export function OrganizationCard({ organization }: OrganizationCardProps) {
  return (
    <Link
      href={`/admin/dashboard/organizations/${organization.id}`}
      className="block bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 p-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
            {organization.name}
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {organization.description}
          </p>
        </div>
        <ShieldCheck className="w-6 h-6 text-green-500" />
      </div>
    </Link>
  );
}
