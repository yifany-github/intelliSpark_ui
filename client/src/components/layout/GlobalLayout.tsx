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
}

export default function GlobalLayout({ 
  children, 
  showTopNav = true, 
  showSidebar = true,
  searchQuery,
  onSearchChange 
}: GlobalLayoutProps) {
  const { isCollapsed } = useNavigation();

  return (
    <div className="min-h-screen w-full bg-gray-900 text-white flex flex-col">
      {showTopNav && (
        <TopNavigation 
          searchQuery={searchQuery} 
          onSearchChange={onSearchChange}
          withSidebar={showSidebar}
        />
      )}
      {showSidebar && <GlobalSidebar />}
      <div className={`flex-1 overflow-auto ${showSidebar ? (isCollapsed ? 'sm:ml-16' : 'sm:ml-64') : ''} ${showTopNav ? 'pt-2' : ''} h-full`}>
        <div className="w-full">
          {children}
        </div>
      </div>
    </div>
  );
}