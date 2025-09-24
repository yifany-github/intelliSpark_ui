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
  contentTopPadding?: boolean;
  maxContentWidthClass?: string;
  contentPaddingClass?: string;
}

export default function GlobalLayout({
  children,
  showTopNav = true,
  showSidebar = true,
  searchQuery,
  onSearchChange,
  hideSearch,
  contentTopPadding = true,
  maxContentWidthClass = 'max-w-[110rem]',
  contentPaddingClass = 'px-4 sm:px-8 lg:px-12 py-6 lg:py-10',
}: GlobalLayoutProps) {
  const { isCollapsed } = useNavigation();

  const sidebarPadding = showSidebar
    ? isCollapsed
      ? 'sm:pl-16'
      : 'sm:pl-64'
    : '';

  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-950 text-white">
      {showTopNav && (
        <TopNavigation
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          withSidebar={showSidebar}
          hideSearch={hideSearch}
        />
      )}
      <div className="flex flex-1">
        {showSidebar && <GlobalSidebar />}
        <main
          className={`flex-1 overflow-y-auto ${sidebarPadding} ${showTopNav && contentTopPadding ? 'pt-4' : ''}`}
        >
          <div className={`mx-auto w-full ${maxContentWidthClass} ${contentPaddingClass}`}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
