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
  | 'strict'
  | 'welcomeBack'
  | 'signIn'
  | 'signUp'
  | 'register'
  | 'createAccount'
  | 'email'
  | 'password'
  | 'confirmPassword'
  | 'enterEmail'
  | 'enterPassword'
  | 'createPassword'
  | 'confirmYourPassword'
  | 'forgotPassword'
  | 'signingIn'
  | 'creatingAccount'
  | 'orContinueWith'
  | 'continueWithGoogle'
  | 'dontHaveAccount'
  | 'alreadyHaveAccount'
  | 'signInToAccount'
  | 'signUpToStart'
  | 'loginRequired'
  | 'pleaseSignIn'
  | 'mustBeAtLeast6Chars'
  | 'passwordsDoNotMatch'
  | 'enterValidEmail'
  | 'loginSuccessful'
  | 'registrationSuccessful'
  | 'accountCreated'
  | 'loginFailed'
  | 'registrationFailed'
  | 'googleLoginFailed'
  | 'heyLetsGetStarted'
  | 'account'
  | 'emailOrName'
  | 'yourPassword'
  | 'otherMethods'
  | 'tokens'
  | 'balance'
  | 'purchaseTokens'
  | 'transactionHistory'
  | 'usageStats'
  | 'tokenBalance'
  | 'currentBalance'
  | 'totalPurchased'
  | 'totalUsed'
  | 'dailyAverage'
  | 'weeklyUsage'
  | 'monthlyUsage'
  | 'dayStreak'
  | 'efficiencyScore'
  | 'mostChattedCharacters'
  | 'dailyUsage'
  | 'lastSevenDays'
  | 'searchTransactions'
  | 'filterByType'
  | 'allTypes'
  | 'purchases'
  | 'usage'
  | 'refunds'
  | 'bonuses'
  | 'noTransactionsFound'
  | 'tryAdjustingSearch'
  | 'transactionHistoryWillAppear'
  | 'completed'
  | 'pending'
  | 'failed'
  | 'purchase'
  | 'refund'
  | 'bonus'
  | 'previous'
  | 'next'
  | 'tryAgain'
  | 'failedToLoad'
  | 'usageStatistics'
  | 'excellent'
  | 'good'
  | 'needsImprovement'
  | 'youMakingGreatUse'
  | 'goodTokenUtilization'
  | 'plentyTokensAvailable'
  | 'howWellYouUse'
  | 'thisWeek'
  | 'thisMonth'
  | 'tokensUsed'
  | 'critical'
  | 'low'
  | 'healthy'
  | 'quickActions'
  | 'buyMoreTokens'
  | 'viewHistory'
  | 'upgradeNow'
  | 'getMoreTokens'
  | 'popular'
  | 'processing'
  | 'purchaseNow'
  | 'securePayment'
  | 'whyChooseTokens'
  | 'neverExpire'
  | 'instantActivation'
  | 'premiumAI'
  | 'support24x7'
  | 'bonusTokens'
  | 'choosePerfectPackage'
  | 'prioritySupport'
  | 'advancedFeatures'
  | 'extendedChatHistory'
  | 'noAuthToken'
  | 'failedToFetchPricingTiers'
  | 'failedToCreatePaymentIntent'
  | 'pleaseLoginToPurchase'
  | 'purchaseFailed'
  | 'failedToFetchTokenBalance'
  | 'failedToFetchTransactionHistory'
  | 'failedToFetchUsageStats'
  | 'active'
  | 'messagesAvailable'
  | 'costPerMessage'
  | 'oneToken'
  | 'lastUpdated'
  | 'quickBuy'
  | 'viewPlans'
  | 'page'
  | 'of'
  | 'faq'
  | 'retry'
  | 'buy'
  | 'purchaseTokensImmediately'
  | 'considerPurchasingMore'
  | 'plentyTokensForChatting'
  | 'readyForAIConversations'
  | 'howTokensWork'
  | 'tokenCostExplanation'
  | 'doTokensExpire'
  | 'tokensNeverExpire'
  | 'canGetRefund'
  | 'refundPolicy'
  | 'paymentsSecure'
  | 'securityInfo'
  | 'manageTokenDescription'
  | 'notifications'
  | 'noNotifications'
  | 'markAllAsRead'
  | 'markAsRead'
  | 'deleteNotification'
  | 'notificationDeleted'
  | 'allNotificationsRead'
  | 'unreadNotifications'
  | 'notificationTypes'
  | 'system'
  | 'payment'
  | 'admin'
  | 'achievement'
  | 'urgent'
  | 'high'
  | 'normal'
  | 'low'
  | 'dismiss'
  | 'acknowledge'
  | 'redirect'
  | 'justNow'
  | 'minutesAgo'
  | 'hoursAgo'
  | 'daysAgo'
  | 'weeksAgo'
  | 'monthsAgo'
  | 'yearsAgo'
  | 'loadMore'
  | 'noMoreNotifications'
  | 'notificationSettings'
  | 'enableNotifications'
  | 'notificationSound'
  | 'paymentNotifications'
  | 'systemNotifications'
  | 'adminNotifications';

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
    welcomeBack: 'Welcome Back',
    signIn: 'Sign In',
    signUp: 'Sign Up',
    register: 'Register',
    createAccount: 'Create Account',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    enterEmail: 'Enter your email',
    enterPassword: 'Enter your password',
    createPassword: 'Create a password',
    confirmYourPassword: 'Confirm your password',
    forgotPassword: 'Forgot password?',
    signingIn: 'Signing in...',
    creatingAccount: 'Creating account...',
    orContinueWith: 'Or continue with',
    continueWithGoogle: 'Continue with Google',
    dontHaveAccount: "Don't have an account? Sign up",
    alreadyHaveAccount: 'Already have an account? Sign in',
    signInToAccount: 'Sign in to your ProductInsightAI account',
    signUpToStart: 'Sign up to start chatting with AI characters',
    loginRequired: 'Login Required',
    pleaseSignIn: 'Please sign in to continue with your chat',
    mustBeAtLeast6Chars: 'Must be at least 6 characters long',
    passwordsDoNotMatch: 'Passwords do not match',
    enterValidEmail: 'Please enter a valid email address',
    loginSuccessful: 'Login successful',
    registrationSuccessful: 'Registration successful',
    accountCreated: 'Welcome! Your account has been created.',
    loginFailed: 'Login failed',
    registrationFailed: 'Registration failed',
    googleLoginFailed: 'Google login failed',
    heyLetsGetStarted: "Hey, let's get started!",
    account: 'Account',
    emailOrName: 'Email address or Name',
    yourPassword: 'Your password',
    otherMethods: 'Other Methods',
    tokens: 'Tokens',
    balance: 'Balance',
    purchaseTokens: 'Purchase Tokens',
    transactionHistory: 'Transaction History',
    usageStats: 'Usage Statistics',
    tokenBalance: 'Token Balance',
    currentBalance: 'Current Balance',
    totalPurchased: 'Total Purchased',
    totalUsed: 'Total Used',
    dailyAverage: 'Daily Average',
    weeklyUsage: 'Weekly Usage',
    monthlyUsage: 'Monthly Usage',
    dayStreak: 'Day Streak',
    efficiencyScore: 'Efficiency Score',
    mostChattedCharacters: 'Most Chatted Characters',
    dailyUsage: 'Daily Usage',
    lastSevenDays: 'Last 7 Days',
    searchTransactions: 'Search transactions...',
    filterByType: 'Filter by type',
    allTypes: 'All Types',
    purchases: 'Purchases',
    usage: 'Usage',
    refunds: 'Refunds',
    bonuses: 'Bonuses',
    noTransactionsFound: 'No transactions found',
    tryAdjustingSearch: 'Try adjusting your search terms',
    transactionHistoryWillAppear: 'Your transaction history will appear here',
    completed: 'Completed',
    pending: 'Pending',
    failed: 'Failed',
    purchase: 'Purchase',
    refund: 'Refund',
    bonus: 'Bonus',
    previous: 'Previous',
    next: 'Next',
    tryAgain: 'Try Again',
    failedToLoad: 'Failed to load',
    usageStatistics: 'Usage Statistics',
    excellent: 'Excellent',
    good: 'Good',
    needsImprovement: 'Needs Improvement',
    youMakingGreatUse: 'You\'re making great use of your tokens!',
    goodTokenUtilization: 'Good token utilization',
    plentyTokensAvailable: 'You have plenty of tokens available',
    howWellYouUse: 'How well you use your tokens',
    thisWeek: 'This Week',
    thisMonth: 'This Month',
    tokensUsed: 'tokens used',
    critical: 'Critical',
    lowBalance: 'Low',
    healthy: 'Healthy',
    quickActions: 'Quick Actions',
    buyMoreTokens: 'Buy More Tokens',
    viewHistory: 'View History',
    upgradeNow: 'Upgrade Now',
    getMoreTokens: 'Get More Tokens',
    popular: 'Popular',
    processing: 'Processing',
    purchaseNow: 'Purchase Now',
    securePayment: 'Secure payment processing powered by Stripe',
    whyChooseTokens: 'Why Choose Our Tokens?',
    neverExpire: 'Never expire',
    instantActivation: 'Instant activation',
    premiumAI: 'Premium AI responses',
    support24x7: '24/7 support',
    bonusTokens: 'bonus tokens',
    choosePerfectPackage: 'Choose the perfect token package for your needs',
    prioritySupport: 'Priority support',
    advancedFeatures: 'Advanced features',
    extendedChatHistory: 'Extended chat history',
    noAuthToken: 'No authentication token found',
    failedToFetchPricingTiers: 'Failed to fetch pricing tiers',
    failedToCreatePaymentIntent: 'Failed to create payment intent',
    pleaseLoginToPurchase: 'Please log in to purchase tokens',
    purchaseFailed: 'Purchase failed',
    failedToFetchTokenBalance: 'Failed to fetch token balance',
    failedToFetchTransactionHistory: 'Failed to fetch transaction history',
    failedToFetchUsageStats: 'Failed to fetch usage statistics',
    active: 'Active',
    messagesAvailable: 'Messages Available',
    costPerMessage: 'Cost per Message',
    oneToken: '1 token',
    lastUpdated: 'Last updated',
    quickBuy: 'Quick Buy',
    viewPlans: 'View Plans',
    page: 'Page',
    of: 'of',
    faq: 'FAQ',
    retry: 'Retry',
    buy: 'Buy',
    purchaseTokensImmediately: 'Purchase tokens immediately to continue chatting',
    considerPurchasingMore: 'Consider purchasing more tokens soon',
    plentyTokensForChatting: 'You have plenty of tokens for chatting',
    readyForAIConversations: 'Ready for AI conversations',
    howTokensWork: 'How do tokens work?',
    tokenCostExplanation: 'Each AI message generation costs 1 token. Tokens are deducted when you receive a response from an AI character.',
    doTokensExpire: 'Do tokens expire?',
    tokensNeverExpire: 'No, tokens never expire. Once purchased, they remain in your account until used.',
    canGetRefund: 'Can I get a refund?',
    refundPolicy: 'Refunds are available within 30 days of purchase for unused tokens. Contact support for assistance.',
    paymentsSecure: 'Are payments secure?',
    securityInfo: 'Yes, all payments are processed securely through Stripe. We never store your payment information.',
    manageTokenDescription: 'Manage your token balance, purchase history, and usage statistics',
    notifications: 'Notifications',
    noNotifications: 'No notifications',
    markAllAsRead: 'Mark all as read',
    markAsRead: 'Mark as read',
    deleteNotification: 'Delete notification',
    notificationDeleted: 'Notification deleted',
    allNotificationsRead: 'All notifications marked as read',
    unreadNotifications: 'Unread notifications',
    notificationTypes: 'Notification types',
    system: 'System',
    payment: 'Payment',
    admin: 'Admin',
    achievement: 'Achievement',
    urgent: 'Urgent',
    high: 'High',
    normal: 'Normal',
    low: 'Low',
    dismiss: 'Dismiss',
    acknowledge: 'Acknowledge',
    redirect: 'View',
    justNow: 'Just now',
    minutesAgo: 'minutes ago',
    hoursAgo: 'hours ago',
    daysAgo: 'days ago',
    weeksAgo: 'weeks ago',
    monthsAgo: 'months ago',
    yearsAgo: 'years ago',
    loadMore: 'Load more',
    noMoreNotifications: 'No more notifications',
    notificationSettings: 'Notification Settings',
    enableNotifications: 'Enable notifications',
    notificationSound: 'Notification sound',
    paymentNotifications: 'Payment notifications',
    systemNotifications: 'System notifications',
    adminNotifications: 'Admin notifications',
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
    welcomeBack: '欢迎回来',
    signIn: '登录',
    signUp: '注册',
    register: '注册',
    createAccount: '创建账户',
    email: '邮箱',
    password: '密码',
    confirmPassword: '确认密码',
    enterEmail: '输入邮箱地址',
    enterPassword: '输入密码',
    createPassword: '创建密码',
    confirmYourPassword: '确认密码',
    forgotPassword: '忘记密码？',
    signingIn: '登录中...',
    creatingAccount: '创建账户中...',
    orContinueWith: '或继续使用',
    continueWithGoogle: '使用Google登录',
    dontHaveAccount: '没有账户？注册',
    alreadyHaveAccount: '已有账户？登录',
    signInToAccount: '登录到您的ProductInsightAI账户',
    signUpToStart: '注册开始与AI角色聊天',
    loginRequired: '需要登录',
    pleaseSignIn: '请登录以继续聊天',
    mustBeAtLeast6Chars: '密码至少6个字符',
    passwordsDoNotMatch: '密码不匹配',
    enterValidEmail: '请输入有效的邮箱地址',
    loginSuccessful: '登录成功',
    registrationSuccessful: '注册成功',
    accountCreated: '欢迎！您的账户已创建',
    loginFailed: '登录失败',
    registrationFailed: '注册失败',
    googleLoginFailed: 'Google登录失败',
    heyLetsGetStarted: '嗨，让我们开始吧！',
    account: '账户',
    emailOrName: '邮箱地址或用户名',
    yourPassword: '请输入密码',
    otherMethods: '其他方式',
    tokens: '代币',
    balance: '余额',
    purchaseTokens: '购买代币',
    transactionHistory: '交易历史',
    usageStats: '使用统计',
    tokenBalance: '代币余额',
    currentBalance: '当前余额',
    totalPurchased: '总购买量',
    totalUsed: '总使用量',
    dailyAverage: '日均使用',
    weeklyUsage: '本周使用',
    monthlyUsage: '本月使用',
    dayStreak: '连续天数',
    efficiencyScore: '效率评分',
    mostChattedCharacters: '最常聊天角色',
    dailyUsage: '每日使用',
    lastSevenDays: '近7天',
    searchTransactions: '搜索交易...',
    filterByType: '按类型筛选',
    allTypes: '所有类型',
    purchases: '购买',
    usage: '使用',
    refunds: '退款',
    bonuses: '奖励',
    noTransactionsFound: '未找到交易记录',
    tryAdjustingSearch: '请尝试调整搜索条件',
    transactionHistoryWillAppear: '您的交易历史将显示在这里',
    completed: '已完成',
    pending: '待处理',
    failed: '失败',
    purchase: '购买',
    refund: '退款',
    bonus: '奖励',
    previous: '上一页',
    next: '下一页',
    tryAgain: '重试',
    failedToLoad: '加载失败',
    usageStatistics: '使用统计',
    excellent: '优秀',
    good: '良好',
    needsImprovement: '需要改进',
    youMakingGreatUse: '您的代币使用效率很高！',
    goodTokenUtilization: '良好的代币使用率',
    plentyTokensAvailable: '您有充足的代币可用',
    howWellYouUse: '代币使用效率如何',
    thisWeek: '本周',
    thisMonth: '本月',
    tokensUsed: '代币使用',
    critical: '紧急',
    lowBalance: '偏低',
    healthy: '健康',
    quickActions: '快速操作',
    buyMoreTokens: '购买更多代币',
    viewHistory: '查看历史',
    upgradeNow: '立即升级',
    getMoreTokens: '获取更多代币',
    popular: '热门',
    processing: '处理中',
    purchaseNow: '立即购买',
    securePayment: '由Stripe提供的安全支付处理',
    whyChooseTokens: '为什么选择我们的代币？',
    neverExpire: '永不过期',
    instantActivation: '即时激活',
    premiumAI: '高级AI响应',
    support24x7: '24/7支持',
    bonusTokens: '奖励代币',
    choosePerfectPackage: '选择适合您需求的完美代币包',
    prioritySupport: '优先支持',
    advancedFeatures: '高级功能',
    extendedChatHistory: '扩展聊天历史',
    noAuthToken: '未找到认证令牌',
    failedToFetchPricingTiers: '获取价格层级失败',
    failedToCreatePaymentIntent: '创建支付意图失败',
    pleaseLoginToPurchase: '请登录以购买代币',
    purchaseFailed: '购买失败',
    failedToFetchTokenBalance: '获取代币余额失败',
    failedToFetchTransactionHistory: '获取交易历史失败',
    failedToFetchUsageStats: '获取使用统计失败',
    active: '活跃',
    messagesAvailable: '可用消息数',
    costPerMessage: '每条消息费用',
    oneToken: '1个代币',
    lastUpdated: '最后更新',
    quickBuy: '快速购买',
    viewPlans: '查看套餐',
    page: '第',
    of: '页 共',
    faq: '常见问题',
    retry: '重试',
    buy: '购买',
    purchaseTokensImmediately: '请立即购买代币以继续聊天',
    considerPurchasingMore: '建议您尽快购买更多代币',
    plentyTokensForChatting: '您有充足的代币用于聊天',
    readyForAIConversations: '准备好进行AI对话',
    howTokensWork: '代币如何工作？',
    tokenCostExplanation: '每次AI消息生成花费1个代币。当您收到AI角色回复时扣除代币。',
    doTokensExpire: '代币会过期吗？',
    tokensNeverExpire: '不会，代币永不过期。购买后将保留在您的账户中直到使用。',
    canGetRefund: '可以退款吗？',
    refundPolicy: '未使用的代币在购买后30天内可以退款。请联系客服寻求帮助。',
    paymentsSecure: '支付安全吗？',
    securityInfo: '是的，所有支付都通过Stripe安全处理。我们从不存储您的支付信息。',
    manageTokenDescription: '管理您的代币余额、购买历史和使用统计',
    notifications: '通知',
    noNotifications: '暂无通知',
    markAllAsRead: '全部标记为已读',
    markAsRead: '标记为已读',
    deleteNotification: '删除通知',
    notificationDeleted: '通知已删除',
    allNotificationsRead: '所有通知已标记为已读',
    unreadNotifications: '未读通知',
    notificationTypes: '通知类型',
    system: '系统',
    payment: '支付',
    admin: '管理员',
    achievement: '成就',
    urgent: '紧急',
    high: '重要',
    normal: '普通',
    low: '一般',
    dismiss: '关闭',
    acknowledge: '确认',
    redirect: '查看',
    justNow: '刚刚',
    minutesAgo: '分钟前',
    hoursAgo: '小时前',
    daysAgo: '天前',
    weeksAgo: '周前',
    monthsAgo: '个月前',
    yearsAgo: '年前',
    loadMore: '加载更多',
    noMoreNotifications: '没有更多通知',
    notificationSettings: '通知设置',
    enableNotifications: '启用通知',
    notificationSound: '通知声音',
    paymentNotifications: '支付通知',
    systemNotifications: '系统通知',
    adminNotifications: '管理员通知',
  },
};

// Language context type
interface LanguageContextType {
  interfaceLanguage: Language;
  chatLanguage: Language;
  language: Language;
  setInterfaceLanguage: (lang: Language) => void;
  setChatLanguage: (lang: Language) => void;
  setLanguage: (lang: Language) => void;
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
    language: interfaceLanguage,
    setInterfaceLanguage,
    setChatLanguage,
    setLanguage: setInterfaceLanguage,
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