import { 
  Home, 
  Heart, 
  Coins, 
  Trophy, 
  MessageSquare, 
  Plus, 
  User, 
  Bell, 
  Star, 
  Search,
  Settings,
  HelpCircle,
  FileText,
  Smartphone,
  Twitter,
  MessageCircle,
  Menu,
  ChevronLeft
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';
import { useNavigation } from '@/contexts/NavigationContext';

export default function GlobalSidebar() {
  const { user } = useAuth();
  const [location, navigate] = useLocation();
  const { isCollapsed, toggleCollapsed } = useNavigation();

  const menuItems = [
    { icon: Home, label: 'Home', path: '/', active: location === '/' || location === '/characters' },
    { icon: MessageSquare, label: 'Recent Chats', path: '/chats', active: location === '/chats' || location.startsWith('/chats/') },
    { icon: Heart, label: 'Favorites', path: '/favorites', active: location === '/favorites' },
    { icon: Search, label: 'Discover', path: '/discover', active: location === '/discover' },
    { icon: Plus, label: 'Create Character', path: '/create-character', active: location === '/create-character' },
    { icon: Coins, label: 'Tokens', path: '/payment', badge: 'Updated', active: location === '/payment' },
    { icon: User, label: 'Profile', path: '/profile', active: location === '/profile' },
    { icon: Bell, label: 'Notifications', path: '/notifications', active: location === '/notifications' },
    { icon: Settings, label: 'Settings', path: '/settings', active: location === '/settings' },
  ];

  const bottomLinks = [
    { icon: HelpCircle, label: 'About Us', path: '/about' },
    { icon: FileText, label: 'FAQ', path: '/faq' },
    { icon: FileText, label: 'Blog', path: '/blog' },
  ];

  return (
    <div className={`${isCollapsed ? 'w-16' : 'w-64'} bg-gray-800 border-r border-gray-700 h-full transition-all duration-300 flex flex-col`}>
      <div className="p-4 flex-1">
        {/* Toggle Button */}
        <div className="flex items-center justify-between mb-6">
          {!isCollapsed && (
            <span className="text-lg font-bold text-white">Navigation</span>
          )}
          <button
            onClick={toggleCollapsed}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <Menu className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronLeft className="w-5 h-5 text-gray-400" />
            )}
          </button>
        </div>

        {/* User Profile */}
        <div className={`flex items-center mb-6 ${isCollapsed ? 'justify-center' : 'space-x-3'}`}>
          <div 
            className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center hover:bg-gray-500 transition-colors cursor-pointer"
            title={isCollapsed ? user?.email?.split('@')[0] || 'Guest' : undefined}
          >
            <span className="text-sm text-white font-medium">{user?.email?.[0]?.toUpperCase() || 'U'}</span>
          </div>
          {!isCollapsed && (
            <div>
              <div className="font-medium text-white">{user?.email?.split('@')[0] || 'Guest'}</div>
              <div className="text-sm text-green-400 flex items-center">
                <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                50 Tokens
              </div>
            </div>
          )}
        </div>

        {/* Navigation Menu */}
        <nav className="space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'space-x-3 px-3'} py-2 rounded-lg transition-colors ${
                item.active 
                  ? 'bg-pink-600 text-white' 
                  : 'text-gray-300 hover:bg-gray-700'
              }`}
              title={isCollapsed ? item.label : undefined}
            >
              <item.icon className="w-5 h-5" />
              {!isCollapsed && (
                <>
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge && (
                    <span className="bg-red-500 text-xs px-2 py-1 rounded">{item.badge}</span>
                  )}
                </>
              )}
            </button>
          ))}
        </nav>
      </div>
      
      {/* Bottom Links */}
      <div className="p-4 border-t border-gray-700">
        <div className="space-y-2 mb-4">
          {bottomLinks.map((link) => (
            <button
              key={link.path}
              onClick={() => navigate(link.path)}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'space-x-3 px-3'} py-2 rounded-lg text-gray-400 hover:bg-gray-700 text-sm transition-colors`}
              title={isCollapsed ? link.label : undefined}
            >
              <link.icon className="w-4 h-4" />
              {!isCollapsed && <span>{link.label}</span>}
            </button>
          ))}
        </div>
        
        {!isCollapsed && (
          <>
            <div className="flex space-x-2 px-3 py-2 justify-center">
              <Smartphone className="w-4 h-4 text-gray-400" />
              <Twitter className="w-4 h-4 text-gray-400" />
              <MessageCircle className="w-4 h-4 text-gray-400" />
            </div>
            
            <div className="text-xs text-gray-500 px-3 text-center">
              <div>Privacy Policy | Terms of Use</div>
              <div className="mt-1">© 2024 ProductInsightAI</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}