import { ReactNode } from 'react';
import TopNavigation from './TopNavigation';
import GlobalSidebar from './GlobalSidebar';
import { useNavigation } from '@/contexts/NavigationContext';
import { cn } from '@/lib/utils';

interface GlobalLayoutProps {
  children: ReactNode;
  showTopNav?: boolean;
  showTopNavOnMobile?: boolean;
  showSidebar?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  hideSearch?: boolean;
  contentTopPadding?: boolean;
  maxContentWidthClass?: string;
  contentPaddingClass?: string;
  mainClassName?: string;
  mainScrollable?: boolean;
}

export default function GlobalLayout({
  children,
  showTopNav = true,
  showTopNavOnMobile = true,
  showSidebar = true,
  searchQuery,
  onSearchChange,
  hideSearch,
  contentTopPadding = true,
  maxContentWidthClass = 'max-w-[110rem]',
  contentPaddingClass = 'px-4 sm:px-8 lg:px-12 py-6 lg:py-10',
  mainClassName = '',
  mainScrollable = true,
}: GlobalLayoutProps) {
  const { isCollapsed } = useNavigation();

  const sidebarPadding = showSidebar
    ? isCollapsed
      ? 'sm:pl-16'
      : 'sm:pl-64'
    : '';

  const mainClasses = cn(
    'flex-1 min-h-0',
    mainScrollable ? 'overflow-y-auto' : 'overflow-hidden',
    sidebarPadding,
    showTopNav && contentTopPadding && 'pt-4 md:pt-[76px]',
    mainClassName,
  );

  return (
    <div className="flex min-h-screen w-full flex-col text-white">
      {showTopNav && (
        <div className={cn(!showTopNavOnMobile && "hidden md:block")}>
          <TopNavigation
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            withSidebar={showSidebar}
            hideSearch={hideSearch}
          />
        </div>
      )}
      <div className="flex flex-1">
        {showSidebar && <GlobalSidebar />}
        <main
          className={mainClasses}
        >
          <div className={`mx-auto w-full ${maxContentWidthClass} ${contentPaddingClass}`}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
