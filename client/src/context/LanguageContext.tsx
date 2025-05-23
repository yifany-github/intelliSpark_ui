import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

// Define available languages
export type Language = 'en' | 'zh';
export type LanguageDirection = 'ltr' | 'rtl';

// Define language config
interface LanguageConfig {
  code: Language;
  name: string; // Display name in its own language
  englishName: string; // Display name in English
  direction: LanguageDirection;
}

// Define supported languages
export const LANGUAGES: Record<Language, LanguageConfig> = {
  en: {
    code: 'en',
    name: 'English',
    englishName: 'English',
    direction: 'ltr',
  },
  zh: {
    code: 'zh',
    name: '中文',
    englishName: 'Chinese',
    direction: 'ltr',
  },
};

// Type for translations
export type TranslationKey = 
  | 'scenes'
  | 'characters'
  | 'chats'
  | 'profile'
  | 'selectScene'
  | 'selectCharacter'
  | 'chooseCharacter'
  | 'startChat'
  | 'send'
  | 'testVoice'
  | 'voiceStyle'
  | 'backstory'
  | 'personalityTraits'
  | 'settings'
  | 'interfaceLanguage'
  | 'chatLanguage'
  | 'nsfwLevel'
  | 'temperatureLevel'
  | 'contextWindowLength'
  | 'memoryEnabled'
  | 'save'
  | 'cancel'
  | 'searchScenes'
  | 'searchCharacters'
  | 'typeMessage'
  | 'noChatsYet'
  | 'startChatWith'
  | 'viewAllScenes'
  | 'viewAllCharacters'
  | 'clearChatHistory'
  | 'exportScripts'
  | 'subscribe'
  | 'loadingMessages'
  | 'errorLoading'
  | 'noMessagesYet'
  | 'startNewChat'
  | 'todaysChatTime'
  | 'totalCharacters'
  | 'activeScenes'
  | 'short'
  | 'long'
  | 'precise'
  | 'creative'
  | 'none'
  | 'strict';

// Define translations for each language
const translations: Record<Language, Record<TranslationKey, string>> = {
  en: {
    scenes: 'Scenes',
    characters: 'Characters',
    chats: 'Chats',
    profile: 'Profile',
    selectScene: 'Select a Scene',
    selectCharacter: 'Select a Character',
    chooseCharacter: 'Choose a character from the list to view details',
    startChat: 'Start Chat',
    send: 'Send',
    testVoice: 'Test Voice',
    voiceStyle: 'Voice Style',
    backstory: 'Backstory',
    personalityTraits: 'Personality Traits',
    settings: 'Settings',
    interfaceLanguage: 'Interface Language',
    chatLanguage: 'Chat Language',
    nsfwLevel: 'NSFW Level',
    temperatureLevel: 'Temperature',
    contextWindowLength: 'Context Window Length',
    memoryEnabled: 'Memory Enabled',
    save: 'Save',
    cancel: 'Cancel',
    searchScenes: 'Search scenes...',
    searchCharacters: 'Search characters...',
    typeMessage: 'Type a message...',
    noChatsYet: 'No chats yet',
    startChatWith: 'Start Chat with',
    viewAllScenes: 'View All Scenes',
    viewAllCharacters: 'View All Characters',
    clearChatHistory: 'Clear Chat History',
    exportScripts: 'Export Scripts',
    subscribe: 'Subscribe / Buy Tokens',
    loadingMessages: 'Loading messages...',
    errorLoading: 'Error loading messages',
    noMessagesYet: 'No messages yet. Start the conversation!',
    startNewChat: 'Start a new chat',
    todaysChatTime: 'Today\'s Chat Time',
    totalCharacters: 'Total Characters',
    activeScenes: 'Active Scenes',
    short: 'Short',
    long: 'Long',
    precise: 'Precise',
    creative: 'Creative',
    none: 'None',
    strict: 'Strict',
  },
  zh: {
    scenes: '场景',
    characters: '角色',
    chats: '聊天',
    profile: '个人资料',
    selectScene: '选择场景',
    selectCharacter: '选择角色',
    chooseCharacter: '从列表中选择一个角色查看详情',
    startChat: '开始聊天',
    send: '发送',
    testVoice: '测试语音',
    voiceStyle: '语音风格',
    backstory: '背景故事',
    personalityTraits: '性格特点',
    settings: '设置',
    interfaceLanguage: '界面语言',
    chatLanguage: '聊天语言',
    nsfwLevel: '成人内容级别',
    temperatureLevel: '随机度',
    contextWindowLength: '上下文窗口长度',
    memoryEnabled: '启用记忆',
    save: '保存',
    cancel: '取消',
    searchScenes: '搜索场景...',
    searchCharacters: '搜索角色...',
    typeMessage: '输入消息...',
    noChatsYet: '还没有聊天',
    startChatWith: '与以下角色开始聊天',
    viewAllScenes: '查看所有场景',
    viewAllCharacters: '查看所有角色',
    clearChatHistory: '清除聊天历史',
    exportScripts: '导出对话脚本',
    subscribe: '订阅/购买代币',
    loadingMessages: '加载消息中...',
    errorLoading: '加载消息出错',
    noMessagesYet: '还没有消息。开始对话吧！',
    startNewChat: '开始新的聊天',
    todaysChatTime: '今日聊天时间',
    totalCharacters: '角色总数',
    activeScenes: '活跃场景',
    short: '短',
    long: '长',
    precise: '精确',
    creative: '创意',
    none: '无',
    strict: '严格',
  },
};

// Language context type
interface LanguageContextType {
  interfaceLanguage: Language;
  chatLanguage: Language;
  setInterfaceLanguage: (lang: Language) => void;
  setChatLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
  availableLanguages: typeof LANGUAGES;
  direction: LanguageDirection;
}

// Create the context
const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Language provider component
export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Get stored language preferences or default to English
  const [interfaceLanguage, setInterfaceLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('interfaceLanguage');
    return (saved as Language) || 'en';
  });
  
  const [chatLanguage, setChatLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('chatLanguage');
    return (saved as Language) || 'en';
  });

  // Save language preferences when they change
  useEffect(() => {
    localStorage.setItem('interfaceLanguage', interfaceLanguage);
  }, [interfaceLanguage]);

  useEffect(() => {
    localStorage.setItem('chatLanguage', chatLanguage);
  }, [chatLanguage]);

  // Translation function
  const t = (key: TranslationKey): string => {
    return translations[interfaceLanguage][key] || translations.en[key];
  };

  // Current direction (for RTL languages)
  const direction = LANGUAGES[interfaceLanguage].direction;

  const value = {
    interfaceLanguage,
    chatLanguage,
    setInterfaceLanguage,
    setChatLanguage,
    t,
    availableLanguages: LANGUAGES,
    direction,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

// Hook for using the language context
export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};