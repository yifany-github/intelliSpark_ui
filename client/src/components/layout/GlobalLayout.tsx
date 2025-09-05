import { ReactNode } from 'react';
import TopNavigation from './TopNavigation';
import GlobalSidebar from './GlobalSidebar';
import { useNavigation } from '@/contexts/NavigationContext';

interface GlobalLayoutProps {
  children: ReactNode;
  showTopNav?: boolean;
  showSidebar?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  hideSearch?: boolean;
  contentTopPadding?: boolean; // add or remove top padding below top nav
}

export default function GlobalLayout({ 
  children, 
  showTopNav = true, 
  showSidebar = true,
  searchQuery,
  onSearchChange,
  hideSearch,
  contentTopPadding = true
}: GlobalLayoutProps) {
  const { isCollapsed } = useNavigation();

  return (
    <div className="min-h-screen w-full bg-gray-900 text-white flex flex-col overflow-x-hidden">
      {showTopNav && (
        <TopNavigation 
          searchQuery={searchQuery} 
          onSearchChange={onSearchChange}
          withSidebar={showSidebar}
          hideSearch={hideSearch}
        />
      )}
      {showSidebar && <GlobalSidebar />}
      <div className={`flex-1 overflow-auto ${showSidebar ? (isCollapsed ? 'sm:pl-16' : 'sm:pl-64') : ''} ${showTopNav && contentTopPadding ? 'pt-2' : ''}`}>
        {children}
      </div>
    </div>
  );
}
