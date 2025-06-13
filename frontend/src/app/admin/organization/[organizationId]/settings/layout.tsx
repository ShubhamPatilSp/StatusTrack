import { FC, ReactNode } from 'react';

interface OrgSettingsLayoutProps {
  children: ReactNode;
}

const OrgSettingsLayout: FC<OrgSettingsLayoutProps> = ({ children }) => {
  return (
    <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-6">Organization Settings</h1>
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6">
            {children}
        </div>
    </div>
  );
};

export default OrgSettingsLayout;
