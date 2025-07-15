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
        />
      )}
      <div className="flex flex-1 overflow-hidden">
        {showSidebar && (
          <div className={`${isCollapsed ? 'hidden sm:block' : 'block'} flex-shrink-0`}>
            <GlobalSidebar />
          </div>
        )}
        <div className="flex-1 overflow-auto">
          <div className="w-full max-w-none">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}