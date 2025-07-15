import React, { useState } from 'react';
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
  ChevronDown,
  Settings,
  HelpCircle,
  FileText,
  Smartphone,
  Twitter,
  MessageCircle,
  Crown,
  Flame,
  TrendingUp,
  Users,
  Eye,
  Bookmark
} from 'lucide-react';

interface Character {
  id: string;
  name: string;
  username: string;
  description: string;
  avatar: string;
  tags: string[];
  stats: string;
  isNSFW: boolean;
  isPremium?: boolean;
  isVerified?: boolean;
}

function App() {
  const [activeTab, setActiveTab] = useState('Characters');
  const [selectedFilter, setSelectedFilter] = useState('Popular');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [genderFilter, setGenderFilter] = useState('All');
  const [nsfwEnabled, setNsfwEnabled] = useState(true);
  const [gifEnabled, setGifEnabled] = useState(true);

  const tabs = ['Characters', 'Photos', 'Memories'];
  const filters = ['Popular', 'Recent', 'Trending', 'New', 'Following', 'Editor Choice'];
  const categories = ['All', 'Figure', 'Persona Card', 'Anime', 'Anthro/Human-Animal Hybrid', 'Assistant', 'Action/Adventure', 'Affectionate', 'BDSM', 'Breeding', 'Bisexual', 'Burritowers'];

  const characters: Character[] = [
    {
      id: '1',
      name: 'Mom',
      username: '@cool cool',
      description: 'You find your mother in...',
      avatar: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&fit=crop',
      tags: ['Submissive', 'MILF', 'Kinky'],
      stats: '16.7M',
      isNSFW: true
    },
    {
      id: '2',
      name: 'Lesbian Gym Ro...',
      username: '@Matrix ♦ lite...',
      description: 'Male POV/Action) You...',
      avatar: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&fit=crop',
      tags: ['Cheating', 'CNC', 'OC', 'Femdom', 'Lesbian'],
      stats: '8.1M',
      isNSFW: true
    },
    {
      id: '3',
      name: 'Goth Sister',
      username: '@Phú Hoàng',
      description: '(Vanilla/Incest) Your la...',
      avatar: 'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&fit=crop',
      tags: ['Submissive', 'Incest', 'Huge Breasts', 'Kinky'],
      stats: '6.6M',
      isNSFW: true
    },
    {
      id: '4',
      name: 'Your Daughter is ...',
      username: '@Venom Master',
      description: '(Incest, Prostitute, NTR) ...',
      avatar: 'https://images.pexels.com/photos/1130626/pexels-photo-1130626.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&fit=crop',
      tags: ['Incest', 'Cheating', 'CNC', 'Submissive', 'OC'],
      stats: '4.3M',
      isNSFW: true
    },
    {
      id: '5',
      name: 'Reika- Bisexual R...',
      username: '@ItzMendo',
      description: 'You need a new apartm...',
      avatar: 'https://images.pexels.com/photos/1542085/pexels-photo-1542085.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&fit=crop',
      tags: ['CNC', 'Bisexual', 'Breeding'],
      stats: '1.6M',
      isNSFW: true
    },
    {
      id: '6',
      name: 'Your Depressed ...',
      username: '@The Burrito...',
      description: '5000+ NSFW images 200 Unlimited bots On Subscription',
      avatar: 'https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&fit=crop',
      tags: ['NEET', 'Free use', 'OC', 'Incest', 'Huge Breasts', 'MILF'],
      stats: '6.8M',
      isNSFW: true,
      isPremium: true
    },
    {
      id: '7',
      name: 'Clara | Bully\'s Arr...',
      username: '@Matrix ♦ lite...',
      description: 'Your bully\'s mom invit...',
      avatar: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&fit=crop',
      tags: ['BDSM', 'Breeding', 'Bisexual', 'Cheating'],
      stats: '1.2M',
      isNSFW: true
    },
    {
      id: '8',
      name: 'Rika Kazama | Ma...',
      username: '@Yunk',
      description: 'Arranged Marriage with...',
      avatar: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&fit=crop',
      tags: ['Tomboy', 'Tsundere', 'Juiciest', 'Comedy'],
      stats: '1.4M',
      isNSFW: true
    }
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Top Navigation */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Left side */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-lg flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-green-400">JuicyChat</span>
            </div>
            
            {/* Search Bar */}
            <div className="relative w-96">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search"
                className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 text-white placeholder-gray-400"
              />
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center space-x-4">
            <button className="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
              💖 Subscribe 70% OFF
            </button>
            
            <div className="flex items-center space-x-2">
              <span className="text-sm">English</span>
              <ChevronDown className="w-4 h-4" />
            </div>
            
            <div className="flex items-center space-x-2 bg-gray-700 rounded-lg px-3 py-2">
              <div className="w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center">
                <span className="text-xs">Y</span>
              </div>
              <span className="text-sm">Free Plan</span>
            </div>
          </div>
        </div>

        {/* Message limit indicator */}
        <div className="px-4 pb-3">
          <div className="flex items-center space-x-2 text-sm text-gray-400">
            <span>❌ 1/10 Send 10 messages</span>
            <div className="ml-auto flex items-center space-x-2">
              <span>⚙️ x10</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Left Sidebar */}
        <div className="w-64 bg-gray-800 border-r border-gray-700 min-h-screen">
          <div className="p-4">
            {/* User Profile */}
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center">
                <span className="text-sm">Y</span>
              </div>
              <div>
                <div className="font-medium">Yifan Yang</div>
                <div className="text-sm text-green-400 flex items-center">
                  <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                  50
                </div>
              </div>
            </div>

            {/* Navigation Menu */}
            <nav className="space-y-2">
              <a href="#" className="flex items-center space-x-3 px-3 py-2 rounded-lg bg-pink-600 text-white">
                <Home className="w-5 h-5" />
                <span>Home</span>
              </a>
              <a href="#" className="flex items-center space-x-3 px-3 py-2 rounded-lg text-gray-300 hover:bg-gray-700">
                <Heart className="w-5 h-5" />
                <span>Membership</span>
                <span className="ml-auto bg-red-500 text-xs px-2 py-1 rounded">Updated</span>
              </a>
              <a href="#" className="flex items-center space-x-3 px-3 py-2 rounded-lg text-gray-300 hover:bg-gray-700">
                <Coins className="w-5 h-5" />
                <span>Coins</span>
                <span className="ml-auto bg-red-500 text-xs px-2 py-1 rounded">Updated</span>
              </a>
              <a href="#" className="flex items-center space-x-3 px-3 py-2 rounded-lg text-gray-300 hover:bg-gray-700">
                <Trophy className="w-5 h-5" />
                <span>Leaderboard</span>
              </a>
              <a href="#" className="flex items-center space-x-3 px-3 py-2 rounded-lg text-gray-300 hover:bg-gray-700">
                <MessageSquare className="w-5 h-5" />
                <span>Recent Chats</span>
              </a>
              <a href="#" className="flex items-center space-x-3 px-3 py-2 rounded-lg text-gray-300 hover:bg-gray-700">
                <Plus className="w-5 h-5" />
                <span>Create Character</span>
              </a>
              <a href="#" className="flex items-center space-x-3 px-3 py-2 rounded-lg text-gray-300 hover:bg-gray-700">
                <Plus className="w-5 h-5" />
                <span>Create Images</span>
              </a>
              <a href="#" className="flex items-center space-x-3 px-3 py-2 rounded-lg text-gray-300 hover:bg-gray-700">
                <User className="w-5 h-5" />
                <span>Profile</span>
              </a>
              <a href="#" className="flex items-center space-x-3 px-3 py-2 rounded-lg text-gray-300 hover:bg-gray-700">
                <Bell className="w-5 h-5" />
                <span>Notifications</span>
              </a>
              <a href="#" className="flex items-center space-x-3 px-3 py-2 rounded-lg text-gray-300 hover:bg-gray-700">
                <Star className="w-5 h-5" />
                <span>Favorites</span>
              </a>
              <a href="#" className="flex items-center space-x-3 px-3 py-2 rounded-lg text-gray-300 hover:bg-gray-700">
                <Search className="w-5 h-5" />
                <span>Discover</span>
              </a>
            </nav>

            {/* Bottom Links */}
            <div className="mt-8 pt-4 border-t border-gray-700 space-y-2">
              <a href="#" className="flex items-center space-x-3 px-3 py-2 rounded-lg text-gray-400 hover:bg-gray-700 text-sm">
                <HelpCircle className="w-4 h-4" />
                <span>About Us</span>
              </a>
              <a href="#" className="flex items-center space-x-3 px-3 py-2 rounded-lg text-gray-400 hover:bg-gray-700 text-sm">
                <FileText className="w-4 h-4" />
                <span>FAQ</span>
              </a>
              <a href="#" className="flex items-center space-x-3 px-3 py-2 rounded-lg text-gray-400 hover:bg-gray-700 text-sm">
                <FileText className="w-4 h-4" />
                <span>Blog</span>
              </a>
              
              <div className="flex space-x-2 px-3 py-2">
                <Smartphone className="w-4 h-4 text-gray-400" />
                <Twitter className="w-4 h-4 text-gray-400" />
                <MessageCircle className="w-4 h-4 text-gray-400" />
              </div>
              
              <div className="text-xs text-gray-500 px-3">
                <div>Privacy Policy | Terms of Use</div>
                <div className="mt-2">Android 🟢 ⚙️ 🔄</div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
          {/* Content Header */}
          <div className="mb-6">
            <div className="text-sm text-gray-400 mb-4">
              The platform strictly prohibits content involving minors. If you encounter such content, please report it immediately!
            </div>
            
            {/* Tabs */}
            <div className="flex space-x-6 mb-6">
              {tabs.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`text-lg font-medium pb-2 border-b-2 transition-colors ${
                    activeTab === tab
                      ? 'text-pink-400 border-pink-400'
                      : 'text-gray-400 border-transparent hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Filters */}
            <div className="flex items-center space-x-4 mb-4">
              <div className="flex space-x-2">
                {filters.map(filter => (
                  <button
                    key={filter}
                    onClick={() => setSelectedFilter(filter)}
                    className={`px-3 py-1 rounded-full text-sm transition-colors flex items-center space-x-1 ${
                      selectedFilter === filter
                        ? 'bg-pink-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {filter === 'Popular' && <Flame className="w-3 h-3" />}
                    {filter === 'Trending' && <TrendingUp className="w-3 h-3" />}
                    {filter === 'New' && <Star className="w-3 h-3" />}
                    {filter === 'Following' && <Users className="w-3 h-3" />}
                    {filter === 'Editor Choice' && <Crown className="w-3 h-3" />}
                    <span>{filter}</span>
                  </button>
                ))}
              </div>
              
              <div className="flex items-center space-x-4 ml-auto">
                <div className="flex items-center space-x-2">
                  <span className="text-sm">Gender</span>
                  <select 
                    value={genderFilter}
                    onChange={(e) => setGenderFilter(e.target.value)}
                    className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
                  >
                    <option>All</option>
                    <option>Male</option>
                    <option>Female</option>
                  </select>
                </div>
                
                <div className="flex items-center space-x-2">
                  <span className="text-sm">GIF</span>
                  <button
                    onClick={() => setGifEnabled(!gifEnabled)}
                    className={`w-10 h-6 rounded-full transition-colors ${
                      gifEnabled ? 'bg-pink-600' : 'bg-gray-600'
                    }`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full transition-transform ${
                      gifEnabled ? 'translate-x-5' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
                
                <div className="flex items-center space-x-2">
                  <span className="text-sm">NSFW</span>
                  <button
                    onClick={() => setNsfwEnabled(!nsfwEnabled)}
                    className={`w-10 h-6 rounded-full transition-colors ${
                      nsfwEnabled ? 'bg-pink-600' : 'bg-gray-600'
                    }`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full transition-transform ${
                      nsfwEnabled ? 'translate-x-5' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Category Tags */}
            <div className="flex flex-wrap gap-2 mb-6">
              {categories.map(category => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    selectedCategory === category
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {category}
                </button>
              ))}
              <button className="px-3 py-1 rounded-full text-sm bg-gray-700 text-gray-300 hover:bg-gray-600">
                All tags
              </button>
            </div>
          </div>

          {/* Character Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {characters.map(character => (
              <div key={character.id} className="bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-750 transition-colors cursor-pointer group">
                <div className="relative">
                  <img
                    src={character.avatar}
                    alt={character.name}
                    className="w-full h-64 object-cover"
                  />
                  <div className="absolute top-2 right-2">
                    <button className="p-1 bg-black/50 rounded-full hover:bg-black/70 transition-colors">
                      <Star className="w-4 h-4 text-white" />
                    </button>
                  </div>
                  {character.isPremium && (
                    <div className="absolute top-2 left-2 bg-yellow-500 text-black px-2 py-1 rounded text-xs font-bold">
                      5000+ NSFW images
                      <br />200 Unlimited bots
                      <br />On Subscription
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 right-2">
                    <div className="flex flex-wrap gap-1 mb-2">
                      {character.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="bg-blue-600 text-white px-2 py-1 rounded text-xs">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="p-3">
                  <h3 className="font-semibold text-white mb-1 truncate">{character.name}</h3>
                  <p className="text-xs text-gray-400 mb-2 line-clamp-2">{character.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {character.isNSFW && (
                        <span className="bg-red-600 text-white px-2 py-1 rounded text-xs">NSFW</span>
                      )}
                      <span className="text-xs text-gray-400">⭐</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Eye className="w-3 h-3 text-gray-400" />
                      <span className="text-xs text-gray-400">{character.stats}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;