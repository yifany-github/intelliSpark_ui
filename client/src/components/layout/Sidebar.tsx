import React from 'react';
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
  MessageCircle
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';

const fetchTokenBalance = async () => {
  const token = localStorage.getItem('auth_token');
  if (!token) {
    throw new Error('No authentication token found');
  }

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
  const response = await fetch(`${API_BASE_URL}/api/payment/user/tokens`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch token balance: ${response.status}`);
  }

  return response.json();
};

export default function Sidebar() {
  const { user, isAuthenticated } = useAuth();
  const [location, navigate] = useLocation();

  const { data: tokenBalance, isLoading: tokenLoading, error: tokenError, refetch } = useQuery({
    queryKey: ['tokenBalance', isAuthenticated],
    queryFn: fetchTokenBalance,
    refetchInterval: isAuthenticated ? 30000 : false,
    enabled: isAuthenticated && !!localStorage.getItem('auth_token'),
    staleTime: 0, // Always consider data stale to ensure fresh fetch
    retry: 1,
  });

  // Refetch when authentication status changes
  React.useEffect(() => {
    if (isAuthenticated && localStorage.getItem('auth_token')) {
      refetch();
    }
  }, [isAuthenticated, refetch]);

  const menuItems = [
    { icon: Home, label: 'Home', path: '/', active: location === '/' },
    { icon: Heart, label: 'Membership', path: '/membership', badge: 'Updated' },
    { icon: Coins, label: 'Tokens', path: '/payment', badge: 'Updated' },
    { icon: Trophy, label: 'Leaderboard', path: '/leaderboard' },
    { icon: MessageSquare, label: 'Recent Chats', path: '/chats' },
    { icon: Plus, label: 'Create Character', path: '/create-character' },
    { icon: User, label: 'Profile', path: '/profile' },
    { icon: Bell, label: 'Notifications', path: '/notifications' },
    { icon: Star, label: 'Favorites', path: '/favorites' },
    { icon: Search, label: 'Discover', path: '/discover' },
  ];

  const bottomLinks = [
    { icon: HelpCircle, label: 'About Us', path: '/about' },
    { icon: FileText, label: 'FAQ', path: '/faq' },
    { icon: FileText, label: 'Blog', path: '/blog' },
  ];

  return (
    <div className="w-64 bg-gray-800 border-r border-gray-700 min-h-screen">
      <div className="p-4">
        {/* User Profile */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center">
            <span className="text-sm">{isAuthenticated ? (user?.email?.[0]?.toUpperCase() || 'U') : 'G'}</span>
          </div>
          <div>
            <div className="font-medium">{isAuthenticated ? (user?.email?.split('@')[0] || 'User') : 'Guest'}</div>
            <div className="text-sm text-green-400 flex items-center">
              <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
              {isAuthenticated ? (
                tokenLoading ? 'Loading...' : 
                tokenError ? 'Error loading' : 
                `${tokenBalance?.balance ?? '?'} Tokens`
              ) : 'Not logged in'}
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                item.active 
                  ? 'bg-pink-600 text-white' 
                  : 'text-gray-300 hover:bg-gray-700'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge && (
                <span className="bg-red-500 text-xs px-2 py-1 rounded">{item.badge}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Bottom Links */}
        <div className="mt-8 pt-4 border-t border-gray-700 space-y-2">
          {bottomLinks.map((link) => (
            <button
              key={link.path}
              onClick={() => navigate(link.path)}
              className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-gray-400 hover:bg-gray-700 text-sm"
            >
              <link.icon className="w-4 h-4" />
              <span>{link.label}</span>
            </button>
          ))}
          
          <div className="flex space-x-2 px-3 py-2">
            <Smartphone className="w-4 h-4 text-gray-400" />
            <Twitter className="w-4 h-4 text-gray-400" />
            <MessageCircle className="w-4 h-4 text-gray-400" />
          </div>
          
          <div className="text-xs text-gray-500 px-3">
            <div>Privacy Policy | Terms of Use</div>
            <div className="mt-2">© 2024 ProductInsightAI</div>
          </div>
        </div>
      </div>
    </div>
  );
}