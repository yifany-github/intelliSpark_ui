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
  | 'characters'
  | 'chats'
  | 'profile'
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
  | 'searchCharacters'
  | 'typeMessage'
  | 'noChatsYet'
  | 'startChatWith'
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
  | 'adminNotifications'
  | 'manageAccount'
  | 'recentActivity'
  | 'achievementLevel'
  | 'conversationExpert'
  | 'startedChatWith'
  | 'unlockedAchievement'
  | 'conversationalist'
  | 'explored'
  | 'newCharacters'
  | 'memberSince'
  | 'customizeExperience'
  | 'manageAISettings'
  | 'privacyPreferences'
  | 'getContinue'
  | 'continueConversations'
  | 'purchaseTokenPackages'
  | 'unlimitedChats'
  | 'languageSettings'
  | 'aiSettings'
  | 'contentSafety'
  | 'dataPrivacy'
  | 'accountActions'
  | 'customizeAIChat'
  | 'applicationPreferences'
  | 'interfaceChat'
  | 'controlsContextWindow'
  | 'conversationHistory'
  | 'aiRemembers'
  | 'higherValues'
  | 'moreCreative'
  | 'unpredictable'
  | 'allowAI'
  | 'rememberContext'
  | 'acrossConversations'
  | 'controlsLevel'
  | 'matureContent'
  | 'allowedConversations'
  | 'recentlyUsedSettings'
  | 'yourRecentlyUsed'
  | 'conversationSettings'
  | 'manageToken'
  | 'balancePurchase'
  | 'historyUsage'
  | 'statistics'
  | 'clearHistory'
  | 'exportOptions'
  | 'subscriptionLogout'
  | 'functionality'
  | 'clearAllChat'
  | 'historyAction'
  | 'cannotUndone'
  | 'permanentlyDelete'
  | 'allConversations'
  | 'clearHistory'
  | 'areYouSure'
  | 'wantLogout'
  | 'signOut'
  | 'redirectHome'
  | 'logout'
  | 'dayAgo'
  | 'fromYesterday'
  | 'loading'
  | 'currentlyChatting'
  | 'recentConversations'
  | 'characterInfo'
  | 'startNewChat'
  | 'chatSettings'
  | 'commands'
  | 'tone'
  | 'markdownSupported'
  | 'kindSupportive'
  | 'funLighthearted'
  | 'seriousDramatic'
  | 'characterThinks'
  | 'characterWhispers'
  | 'characterPerforms'
  | 'createCharacter'
  | 'hide'
  | 'show'
  | 'basicInfo'
  | 'personality'
  | 'details'
  | 'essentialDetails'
  | 'characterAvatar'
  | 'uploading'
  | 'uploadAvatar'
  | 'pngJpgUpTo5MB'
  | 'characterName'
  | 'enterCharacterName'
  | 'shortDescription'
  | 'briefDescription'
  | 'detailedBackstory'
  | 'category'
  | 'personalityTraits'
  | 'selectTraits'
  | 'characterTraits'
  | 'personalityDimensions'
  | 'characterDetails'
  | 'additionalInformation'
  | 'gender'
  | 'genderExample'
  | 'age'
  | 'ageExample'
  | 'occupation'
  | 'charactersJob'
  | 'catchphrase'
  | 'memorablePhrase'
  | 'conversationStyle'
  | 'publishingSettings'
  | 'configureSharing'
  | 'makePublic'
  | 'allowOthersDiscover'
  | 'contentRating'
  | 'safe'
  | 'mild'
  | 'moderate'
  | 'mature'
  | 'saveDraft'
  | 'creating'
  | 'preview'
  | 'howCharacterAppears'
  | 'characterNameRequired'
  | 'characterDescriptionRequired'
  | 'characterBackstoryRequired'
  | 'atLeastOneTrait'
  | 'invalidFileType'
  | 'selectImageFile'
  | 'fileTooLarge'
  | 'selectSmallerImage'
  | 'uploadFailed'
  | 'failedToUploadAvatar'
  | 'authenticationRequired'
  | 'characterCreatedSuccessfully'
  | 'pleaseLoginToCreate'
  | 'tokenBalance'
  | 'failedToLoadBalance'
  | 'tokens'
  | 'runningLowTokens'
  | 'lastUpdated'
  | 'clearFilters'
  | 'total'
  | 'discoverPage'
  | 'exploreTrendingCharacters'
  | 'switchToMasonryLayout'
  | 'switchToGridLayout'
  | 'exploreTypes'
  | 'allCharacters'
  | 'fantasyMagic'
  | 'sciFiFuture'
  | 'adventureAction'
  | 'romanceDrama'
  | 'mysteryThriller'
  | 'historical'
  | 'modernLifestyle'
  | 'creativeArts'
  | 'gamingVirtual'
  | 'animeManga'
  | 'moviesTv'
  | 'featuredCharacters'
  | 'handpickedSelections'
  | 'trendingThisWeek'
  | 'hotPicksCommunity'
  | 'newArrivals'
  | 'freshCharactersAdded'
  | 'mostPopular'
  | 'communityFavorites'
  | 'recommendedForYou'
  | 'basedOnPreferences'
  | 'noCharactersFound'
  | 'tryExploringOther'
  | 'viewAllCharacters'
  | 'chatNow'
  | 'creating'
  | 'friendly'
  | 'mysterious'
  | 'intelligent'
  | 'funny'
  | 'serious'
  | 'caring'
  | 'adventurous'
  | 'shy'
  | 'confident'
  | 'creative'
  | 'logical'
  | 'emotional'
  | 'brave'
  | 'cautious'
  | 'optimistic'
  | 'pessimistic'
  | 'loyal'
  | 'independent'
  | 'playful'
  | 'wise'
  | 'curious'
  | 'passionate'
  | 'calm'
  | 'energetic'
  | 'romantic'
  | 'practical'
  | 'friendliness'
  | 'intelligence'
  | 'humor'
  | 'confidence'
  | 'empathy'
  | 'creativity'
  | 'casual'
  | 'formal'
  | 'playful'
  | 'mystical'
  | 'wise'
  | 'dramatic'
  | 'humorous'
  | 'professional'
  | 'sarcastic'
  | 'detailedResponses'
  | 'conciseResponses'
  | 'storytelling'
  | 'interactive'
  | 'questionFocused'
  | 'analytical'
  | 'fantasy'
  | 'sciFi'
  | 'modern'
  | 'historical'
  | 'tokenManagement'
  | 'pleaseLoginToManageTokens'
  | 'exportData'
  | 'buyTokens'
  | 'statistics'
  | 'tokenTips'
  | 'optimizeUsage'
  | 'engageLongerConversations'
  | 'saveOnBulkPurchases'
  | 'largerPackagesBetter'
  | 'buyTokensWhenNeeded'
  | 'tokenPreferences'
  | 'lowBalanceAlerts'
  | 'getNotifiedLowBalance'
  | 'enabled'
  | 'autoPurchase'
  | 'automaticallyBuyTokens'
  | 'disabled'
  | 'usageAnalytics'
  | 'trackDetailedUsage'
  | 'paymentSettings'
  | 'defaultPaymentMethod'
  | 'preferredPackage'
  | 'updatePaymentSettings'
  | 'securityNotice'
  | 'purchaseMoreTokens'
  | 'viewTransactionHistory'
  | 'lowBalance'
  | 'chatWithAICharacters'
  | 'tokensLabel'
  | 'searchCharacters'
  | 'upgradePlan'
  | 'freePlan'
  | 'profile'
  | 'myChats'
  | 'tokensBilling'
  | 'logout'
  | 'login'
  | 'guest'
  | 'home'
  | 'recentChats'
  | 'favorites'
  | 'discover'
  | 'createCharacter'
  | 'aboutUs'
  | 'faq'
  | 'blog'
  | 'navigation'
  | 'expandSidebar'
  | 'collapseSidebar'
  | 'errorLoading'
  | 'notLoggedIn'
  | 'membership'
  | 'leaderboard'
  | 'user'
  | 'privacyPolicy'
  | 'termsOfUse'
  | 'copyright'
  | 'updated'
  | 'discoverAICharacters'
  | 'immersiveConversations'
  | 'popular'
  | 'recent'
  | 'trending'
  | 'new'
  | 'following'
  | 'editorChoice'
  | 'gender'
  | 'all'
  | 'male'
  | 'female'
  | 'anime'
  | 'game'
  | 'movie'
  | 'book'
  | 'original'
  | 'fantasy'
  | 'sciFi'
  | 'romance'
  | 'action'
  | 'chatNow'
  | 'preview'
  | 'noFavoritesYet'
  | 'noCharactersFound'
  | 'startExploring'
  | 'addToFavorites'
  | 'tryAdjustingSearch'
  | 'noCharactersMatch'
  | 'errorLoadingCharacters'
  | 'about'
  | 'traits'
  | 'voiceStyle'
  | 'natural'
  | 'chats'
  | 'removeFromFavorites'
  | 'noDescriptionAvailable'
  | 'myFavorites'
  | 'charactersCount'
  | 'switchToListView'
  | 'switchToGridView'
  | 'searchFavoriteCharacters'
  | 'sortByDate'
  | 'sortByName'
  | 'sortByRating'
  | 'sortAscending'
  | 'sortDescending'
  | 'noMatchingFavorites'
  | 'tryAdjustingFilters'
  | 'exploreCharacters'
  | 'adventure'
  | 'mystery'
  | 'romanceDrama'
  | 'mysteryThriller'
  | 'historical'
  | 'modernLifestyle'
  | 'creativeArts'
  | 'gamingVirtual'
  | 'animeManga'
  | 'moviesTv'
  | 'featuredCharacters'
  | 'handpickedSelections'
  | 'trendingThisWeek'
  | 'hotPicksCommunity'
  | 'newArrivals'
  | 'freshCharactersAdded'
  | 'mostPopular'
  | 'communityFavorites'
  | 'recommendedForYou'
  | 'basedOnPreferences'
  | 'noCharactersFoundInCategory'
  | 'tryExploringOtherCategories'
  | 'viewAllCharacters'
  // Payment form keys
  | 'paymentDetails'
  | 'billingInformation'
  | 'fullName'
  | 'emailAddress'
  | 'addressLine1'
  | 'addressLine2'
  | 'city'
  | 'state'
  | 'zipCode'
  | 'country'
  | 'unitedStates'
  | 'canada'
  | 'unitedKingdom'
  | 'australia'
  | 'germany'
  | 'france'
  | 'japan'
  | 'southKorea'
  | 'singapore'
  | 'china'
  | 'paymentMethod'
  | 'orderSummary'
  | 'total'
  | 'usd'
  | 'perToken'
  | 'tokensPlural'
  | 'agreeToTerms'
  | 'termsOfService'
  | 'and'
  | 'privacyPolicy'
  | 'receivePromotional'
  | 'pay'
  | 'paymentProcessingSecure'
  | 'paymentSuccessful'
  | 'tokensAddedToAccount'
  | 'startChatting'
  | 'backToProfile'
  | 'backToPricing'
  | 'completePurchase'
  | 'buyTokens'
  | 'purchaseTokensToContinue'
  | 'chooseTokenPackage'
  | 'continueToPayment'
  | 'tokenUsage'
  | 'eachAIMessage'
  | 'tokensNeverExpireItem'
  | 'securePaymentsStripe'
  | 'instantDelivery'
  | 'mostPopular'
  | 'pack'
  | 'bonusPercent25'
  | 'bonusPercent50'
  | 'aiConversations'
  | 'optional'
  // Notifications keys
  | 'stayUpdatedAccount'
  | 'notificationsFaq'
  | 'howManageNotifications'
  | 'howManageNotificationsAnswer'
  | 'whyGettingNotifications'
  | 'whyGettingNotificationsAnswer'
  | 'canDisableNotifications'
  | 'canDisableNotificationsAnswer'
  | 'howLongNotificationsStored'
  | 'howLongNotificationsStoredAnswer'
  | 'allTypes'
  | 'clearFilters'
  | 'pleaseSignIn'
  | 'failedToLoad'
  | 'tryAgain'
  | 'viewAll'
  // Other missing keys
  | 'overview'
  | 'history'
  | 'language';

// Define translations for each language
const translations: Record<Language, Record<TranslationKey, string>> = {
  en: {
    characters: 'Characters',
    selectCharacter: 'Select a Character',
    chooseCharacter: 'Choose a character from the list to view details',
    startChat: 'Start Chat',
    send: 'Send',
    testVoice: 'Test Voice',
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
    typeMessage: 'Type a message...',
    noChatsYet: 'No chats yet',
    startChatWith: 'Start Chat with',
    clearChatHistory: 'Clear Chat History',
    exportScripts: 'Export Scripts',
    subscribe: 'Subscribe / Buy Tokens',
    loadingMessages: 'Loading messages...',
    noMessagesYet: 'No messages yet. Start the conversation!',
    startNewChat: 'Start a new chat',
    todaysChatTime: 'Today\'s Chat Time',
    totalCharacters: 'Total Characters',
    short: 'Short',
    long: 'Long',
    precise: 'Precise',
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
    purchases: 'Purchases',
    usage: 'Usage',
    refunds: 'Refunds',
    bonuses: 'Bonuses',
    noTransactionsFound: 'No transactions found',
    transactionHistoryWillAppear: 'Your transaction history will appear here',
    completed: 'Completed',
    pending: 'Pending',
    failed: 'Failed',
    purchase: 'Purchase',
    refund: 'Refund',
    bonus: 'Bonus',
    previous: 'Previous',
    next: 'Next',
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
    quickBuy: 'Quick Buy',
    viewPlans: 'View Plans',
    page: 'Page',
    of: 'of',
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
    manageAccount: 'Manage your account and view your activity',
    recentActivity: 'Recent Activity',
    achievementLevel: 'Achievement Level',
    conversationExpert: 'Conversation Expert',
    startedChatWith: 'Started chat with',
    unlockedAchievement: 'Unlocked achievement',
    conversationalist: 'Conversationalist',
    explored: 'Explored',
    newCharacters: 'new characters',
    memberSince: 'Member since',
    customizeExperience: 'Customize your experience',
    manageAISettings: 'Manage AI settings, preferences, and privacy',
    privacyPreferences: 'and privacy',
    getContinue: 'Get More Tokens',
    continueConversations: 'Continue conversations',
    purchaseTokenPackages: 'Purchase token packages for unlimited chats',
    unlimitedChats: 'unlimited chats',
    languageSettings: 'Language Settings',
    aiSettings: 'AI Settings',
    contentSafety: 'Content & Safety',
    dataPrivacy: 'Data & Privacy',
    accountActions: 'Account Actions',
    customizeAIChat: 'Customize your AI chat experience',
    applicationPreferences: 'and application preferences',
    interfaceChat: 'Interface and chat language',
    controlsContextWindow: 'Controls how much conversation history the AI remembers',
    conversationHistory: 'conversation history',
    aiRemembers: 'the AI remembers',
    higherValues: 'Higher values make responses',
    moreCreative: 'more creative',
    unpredictable: 'and unpredictable',
    allowAI: 'Allow AI to',
    rememberContext: 'remember context',
    acrossConversations: 'across conversations',
    controlsLevel: 'Controls the level of',
    matureContent: 'mature content',
    allowedConversations: 'allowed in conversations',
    recentlyUsedSettings: 'Your recently used',
    yourRecentlyUsed: 'Your recently used',
    conversationSettings: 'conversation settings',
    manageToken: 'Manage your token',
    balancePurchase: 'balance, purchase',
    historyUsage: 'history, and usage',
    clearHistory: 'Clear History',
    exportOptions: 'Export Options',
    subscriptionLogout: 'Subscription and logout',
    functionality: 'functionality',
    clearAllChat: 'Clear all chat',
    historyAction: 'history? This action',
    cannotUndone: 'cannot be undone',
    permanentlyDelete: 'and will permanently delete',
    allConversations: 'all your conversations',
    areYouSure: 'Are you sure you want to',
    wantLogout: 'logout?',
    signOut: 'This will sign you out of your account',
    redirectHome: 'and redirect you to the home page',
    dayAgo: '1 day ago',
    fromYesterday: 'from yesterday',
    getMoreTokens: 'Get More Tokens',
    loading: 'Loading...',
    currentlyChatting: 'Currently chatting',
    recentConversations: 'Recent Conversations',
    characterInfo: 'Character Info',
    chatSettings: 'Chat Settings',
    commands: 'Commands',
    tone: 'Tone',
    markdownSupported: 'Markdown supported',
    kindSupportive: 'Kind and supportive responses',
    funLighthearted: 'Fun and light-hearted tone',
    seriousDramatic: 'Serious and dramatic',
    characterThinks: 'Character thinks to themselves',
    characterWhispers: 'Character whispers quietly',
    characterPerforms: 'Character performs an action',
    hide: 'Hide',
    show: 'Show',
    basicInfo: 'Basic Info',
    personality: 'Personality',
    details: 'Details',
    essentialDetails: 'Essential details about your character',
    characterAvatar: 'Character Avatar',
    uploading: 'Uploading...',
    uploadAvatar: 'Upload Avatar',
    pngJpgUpTo5MB: 'PNG, JPG up to 5MB',
    characterName: 'Character Name',
    enterCharacterName: 'Enter character name',
    shortDescription: 'Short Description',
    briefDescription: 'Brief description of your character (1-2 sentences)',
    detailedBackstory: 'Detailed backstory and background information',
    category: 'Category',
    selectTraits: 'Select traits that define your character\'s personality',
    characterTraits: 'Character Traits',
    personalityDimensions: 'Personality Dimensions',
    characterDetails: 'Character Details',
    additionalInformation: 'Additional information about your character',
    genderExample: 'e.g., Male, Female, Non-binary',
    age: 'Age',
    ageExample: 'e.g., 25, Young Adult, Ancient',
    occupation: 'Occupation',
    charactersJob: 'Character\'s job or role',
    catchphrase: 'Catchphrase',
    memorablePhrase: 'A memorable phrase your character often says',
    conversationStyle: 'Conversation Style',
    publishingSettings: 'Publishing Settings',
    configureSharing: 'Configure how your character will be shared',
    makePublic: 'Make Public',
    allowOthersDiscover: 'Allow others to discover and chat with your character',
    contentRating: 'Content Rating',
    safe: 'Safe',
    mild: 'Mild',
    moderate: 'Moderate',
    mature: 'Mature',
    saveDraft: 'Save Draft',
    howCharacterAppears: 'How your character will appear to others',
    characterNameRequired: 'Character name is required',
    characterDescriptionRequired: 'Character description is required',
    characterBackstoryRequired: 'Character backstory is required',
    atLeastOneTrait: 'At least one trait is required',
    invalidFileType: 'Invalid file type',
    selectImageFile: 'Please select an image file',
    fileTooLarge: 'File too large',
    selectSmallerImage: 'Please select an image smaller than 5MB',
    uploadFailed: 'Upload failed',
    failedToUploadAvatar: 'Failed to upload avatar. Please try again.',
    authenticationRequired: 'Authentication required',
    characterCreatedSuccessfully: 'Character created successfully!',
    pleaseLoginToCreate: 'Please log in to create characters',
    failedToLoadBalance: 'Failed to load balance',
    // Payment form localization
    paymentDetails: 'Payment Details',
    billingInformation: 'Billing Information',
    fullName: 'Full Name',
    emailAddress: 'Email Address',
    addressLine1: 'Address Line 1',
    addressLine2: 'Address Line 2',
    city: 'City',
    state: 'State',
    zipCode: 'ZIP Code',
    country: 'Country',
    unitedStates: 'United States',
    canada: 'Canada',
    unitedKingdom: 'United Kingdom',
    australia: 'Australia',
    germany: 'Germany',
    france: 'France',
    japan: 'Japan',
    southKorea: 'South Korea',
    singapore: 'Singapore',
    china: 'China',
    paymentMethod: 'Payment Method',
    orderSummary: 'Order Summary',
    total: 'Total',
    usd: 'USD',
    perToken: 'per token',
    tokensPlural: 'tokens',
    agreeToTerms: 'I agree to the',
    termsOfService: 'Terms of Service',
    and: 'and',
    receivePromotional: 'I would like to receive promotional emails about new features and special offers',
    pay: 'Pay',
    paymentProcessingSecure: 'Payments are processed securely by Stripe. Your card information is never stored on our servers.',
    paymentSuccessful: 'Payment Successful!',
    tokensAddedToAccount: 'Your tokens have been added to your account. You can now continue chatting with AI characters.',
    startChatting: 'Start Chatting',
    backToProfile: 'Back to Profile',
    backToPricing: 'Back to Pricing',
    completePurchase: 'Complete Purchase',
    purchaseTokensToContinue: 'Purchase tokens to continue chatting with AI characters. Each message costs 1 token.',
    chooseTokenPackage: 'Choose a Token Package',
    continueToPayment: 'Continue to Payment',
    tokenUsage: 'Token Usage',
    eachAIMessage: 'Each AI message generation costs 1 token',
    tokensNeverExpireItem: 'Tokens never expire',
    securePaymentsStripe: 'Secure payments processed by Stripe',
    instantDelivery: 'Instant delivery to your account',
    pack: 'Pack',
    bonusPercent25: '25% bonus',
    bonusPercent50: '50% bonus',
    aiConversations: 'AI conversations',
    optional: 'optional',
    // Notifications page localization
    stayUpdatedAccount: 'Stay updated with your account activities and system announcements',
    notificationsFaq: 'Notifications FAQ',
    howManageNotifications: 'How do I manage notifications?',
    howManageNotificationsAnswer: 'You can filter notifications by type, mark them as read, or delete them individually. Use the settings to customize your notification preferences.',
    whyGettingNotifications: 'Why am I getting notifications?',
    whyGettingNotificationsAnswer: 'We send notifications for important account activities like payments, system updates, and admin announcements to keep you informed.',
    canDisableNotifications: 'Can I disable notifications?',
    canDisableNotificationsAnswer: 'Yes, you can customize your notification preferences in the settings. You can choose which types of notifications you want to receive.',
    howLongNotificationsStored: 'How long are notifications stored?',
    howLongNotificationsStoredAnswer: 'Notifications are kept for 30 days by default. Some important notifications may be stored longer for your reference.',
    allTypes: 'All Types',
    clearFilters: 'Clear Filters',
    pleaseSignIn: 'Please sign in to view notifications',
    failedToLoad: 'Failed to load',
    tryAgain: 'Try Again',
    viewAll: 'View All',
    overview: 'Overview',
    history: 'History',
    language: 'Language',
    runningLowTokens: 'You\'re running low on tokens. Each AI message costs 1 token.',
    lastUpdated: 'Last updated',
    discoverPage: 'Discover',
    exploreTrendingCharacters: 'Explore trending characters, new arrivals, and personalized recommendations',
    switchToMasonryLayout: 'Switch to masonry layout',
    switchToGridLayout: 'Switch to grid layout',
    exploreTypes: 'Explore Types',
    allCharacters: 'All Characters',
    fantasyMagic: 'Fantasy & Magic',
    sciFiFuture: 'Sci-Fi & Future',
    adventureAction: 'Adventure & Action',
    romanceDrama: 'Romance & Drama',
    mysteryThriller: 'Mystery & Thriller',
    modernLifestyle: 'Modern & Lifestyle',
    creativeArts: 'Creative & Arts',
    gamingVirtual: 'Gaming & Virtual',
    animeManga: 'Anime & Manga',
    moviesTv: 'Movies & TV',
    noCharactersFoundInCategory: 'No {category} Characters Found',
    tryExploringOtherCategories: 'Try exploring other categories or check back later for new additions.',
    featuredCharacters: 'Featured Characters',
    handpickedSelections: 'Handpicked selections',
    trendingThisWeek: 'Trending This Week',
    hotPicksCommunity: 'Hot picks from the community',
    newArrivals: 'New Arrivals',
    freshCharactersAdded: 'Fresh characters added recently',
    mostPopular: 'Most Popular',
    communityFavorites: 'Community favorites',
    recommendedForYou: 'Recommended for You',
    basedOnPreferences: 'Based on your preferences',
    tryExploringOther: 'Try exploring other categories or check back later for new additions.',
    viewAllCharacters: 'View All Characters',
    friendly: 'Friendly',
    mysterious: 'Mysterious',
    intelligent: 'Intelligent',
    funny: 'Funny',
    serious: 'Serious',
    caring: 'Caring',
    adventurous: 'Adventurous',
    shy: 'Shy',
    confident: 'Confident',
    creative: 'Creative',
    logical: 'Logical',
    emotional: 'Emotional',
    brave: 'Brave',
    cautious: 'Cautious',
    optimistic: 'Optimistic',
    pessimistic: 'Pessimistic',
    loyal: 'Loyal',
    independent: 'Independent',
    playful: 'Playful',
    wise: 'Wise',
    curious: 'Curious',
    passionate: 'Passionate',
    calm: 'Calm',
    energetic: 'Energetic',
    romantic: 'Romantic',
    practical: 'Practical',
    friendliness: 'Friendliness',
    intelligence: 'Intelligence',
    humor: 'Humor',
    confidence: 'Confidence',
    empathy: 'Empathy',
    creativity: 'Creativity',
    casual: 'Casual',
    formal: 'Formal',
    mystical: 'Mystical',
    dramatic: 'Dramatic',
    humorous: 'Humorous',
    professional: 'Professional',
    sarcastic: 'Sarcastic',
    detailedResponses: 'Detailed responses',
    conciseResponses: 'Concise responses',
    storytelling: 'Storytelling',
    interactive: 'Interactive',
    questionFocused: 'Question-focused',
    analytical: 'Analytical',
    modern: 'Modern',
    historical: 'Historical',
    tokenManagement: 'Token Management',
    pleaseLoginToManageTokens: 'Please log in to manage your tokens',
    exportData: 'Export Data',
    buyTokens: 'Buy Tokens',
    statistics: 'Statistics',
    tokenTips: 'Token Tips',
    optimizeUsage: 'Optimize Your Usage',
    engageLongerConversations: 'Engage in longer conversations to get more value from each token',
    saveOnBulkPurchases: 'Save on Bulk Purchases',
    largerPackagesBetter: 'Larger token packages offer better value per token',
    buyTokensWhenNeeded: 'Buy tokens when you need them - they\'ll always be available',
    tokenPreferences: 'Token Preferences',
    lowBalanceAlerts: 'Low Balance Alerts',
    getNotifiedLowBalance: 'Get notified when your token balance is low',
    enabled: 'Enabled',
    autoPurchase: 'Auto-Purchase',
    automaticallyBuyTokens: 'Automatically buy tokens when balance is low',
    disabled: 'Disabled',
    usageAnalytics: 'Usage Analytics',
    trackDetailedUsage: 'Track detailed usage patterns and insights',
    paymentSettings: 'Payment Settings',
    defaultPaymentMethod: 'Default Payment Method',
    preferredPackage: 'Preferred Package',
    updatePaymentSettings: 'Update Payment Settings',
    securityNotice: 'Security Notice',
    purchaseMoreTokens: 'Purchase More Tokens',
    viewTransactionHistory: 'View Transaction History',
    chatWithAICharacters: 'Chat with AI characters',
    tokensLabel: 'Tokens',
    searchCharacters: 'Search characters...',
    upgradePlan: 'Upgrade Plan',
    freePlan: 'Free Plan',
    profile: 'Profile',
    myChats: 'My Chats',
    tokensBilling: 'Tokens & Billing',
    logout: 'Logout',
    login: 'Login',
    guest: 'Guest',
    home: 'Home',
    recentChats: 'Recent Chats',
    favorites: 'Favorites',
    discover: 'Discover',
    createCharacter: 'Create Character',
    aboutUs: 'About Us',
    faq: 'FAQ',
    blog: 'Blog',
    navigation: 'Navigation',
    expandSidebar: 'Expand sidebar',
    collapseSidebar: 'Collapse sidebar',
    errorLoading: 'Error loading',
    notLoggedIn: 'Not logged in',
    membership: 'Membership',
    leaderboard: 'Leaderboard',
    user: 'User',
    privacyPolicy: 'Privacy Policy',
    termsOfUse: 'Terms of Use',
    copyright: '© 2024 ProductInsightAI',
    updated: 'Updated',
    discoverAICharacters: 'Discover amazing AI characters for immersive conversations',
    immersiveConversations: 'for immersive conversations',
    popular: 'Popular',
    recent: 'Recent',
    trending: 'Trending',
    new: 'New',
    following: 'Following',
    editorChoice: 'Editor Choice',
    gender: 'Gender',
    all: 'All',
    male: 'Male',
    female: 'Female',
    anime: 'Anime',
    game: 'Game',
    movie: 'Movie',
    book: 'Book',
    original: 'Original',
    fantasy: 'Fantasy',
    sciFi: 'Sci-Fi',
    romance: 'Romance',
    action: 'Action',
    chatNow: 'Chat Now',
    preview: 'Preview',
    noFavoritesYet: 'No favorites yet',
    noCharactersFound: 'No characters found',
    startExploring: 'Start exploring characters and add them to your favorites',
    tryAdjustingSearch: 'Try adjusting your search terms or filters',
    noCharactersMatch: 'No characters match your current filters',
    errorLoadingCharacters: 'Error loading characters. Please try again.',
    about: 'About',
    traits: 'Traits',
    voiceStyle: 'Voice Style',
    natural: 'Natural',
    chats: 'chats',
    removeFromFavorites: 'Remove from Favorites',
    addToFavorites: 'Add to Favorites',
    noDescriptionAvailable: 'No description available.',
    myFavorites: 'My Favorites',
    charactersCount: 'characters',
    switchToListView: 'Switch to list view',
    switchToGridView: 'Switch to grid view',
    searchFavoriteCharacters: 'Search your favorite characters...',
    sortByDate: 'Sort by Date',
    sortByName: 'Sort by Name',
    sortByRating: 'Sort by Rating',
    sortAscending: 'Sort ascending',
    sortDescending: 'Sort descending',
    noMatchingFavorites: 'No matching favorites',
    tryAdjustingFilters: 'Try adjusting your search or filter criteria',
    exploreCharacters: 'Explore Characters',
    creating: 'Creating...',
    adventure: 'Adventure',
    mystery: 'Mystery',
  },
  zh: {
    characters: '角色',
    selectCharacter: '选择角色',
    chooseCharacter: '从列表中选择一个角色查看详情',
    startChat: '开始聊天',
    send: '发送',
    testVoice: '测试语音',
    backstory: '背景故事',
    settings: '设置',
    interfaceLanguage: '界面语言',
    chatLanguage: '聊天语言',
    nsfwLevel: '成人内容级别',
    temperatureLevel: '随机度',
    contextWindowLength: '上下文窗口长度',
    memoryEnabled: '启用记忆',
    save: '保存',
    cancel: '取消',
    typeMessage: '输入消息...',
    noChatsYet: '还没有聊天',
    startChatWith: '与以下角色开始聊天',
    clearChatHistory: '清除聊天历史',
    exportScripts: '导出对话脚本',
    subscribe: '订阅/购买代币',
    loadingMessages: '加载消息中...',
    // Payment form localization - Chinese
    paymentDetails: '付款详情',
    billingInformation: '账单信息',
    fullName: '全名',
    emailAddress: '邮箱地址',
    addressLine1: '地址行 1',
    addressLine2: '地址行 2',
    city: '城市',
    state: '州/省',
    zipCode: '邮政编码',
    country: '国家',
    unitedStates: '美国',
    canada: '加拿大',
    unitedKingdom: '英国',
    australia: '澳大利亚',
    germany: '德国',
    france: '法国',
    japan: '日本',
    southKorea: '韩国',
    singapore: '新加坡',
    china: '中国',
    paymentMethod: '付款方式',
    orderSummary: '订单摘要',
    usd: '美元',
    perToken: '每代币',
    tokensPlural: '代币',
    agreeToTerms: '我同意',
    termsOfService: '服务条款',
    and: '和',
    receivePromotional: '我希望接收关于新功能和特别优惠的促销邮件',
    pay: '支付',
    paymentProcessingSecure: '付款由 Stripe 安全处理。您的卡片信息永远不会存储在我们的服务器上。',
    paymentSuccessful: '付款成功！',
    tokensAddedToAccount: '您的代币已添加到您的账户。您现在可以继续与 AI 角色聊天。',
    startChatting: '开始聊天',
    backToProfile: '返回个人资料',
    backToPricing: '返回定价',
    completePurchase: '完成购买',
    purchaseTokensToContinue: '购买代币以继续与 AI 角色聊天。每条消息花费 1 个代币。',
    chooseTokenPackage: '选择代币套餐',
    continueToPayment: '继续付款',
    tokenUsage: '代币使用',
    eachAIMessage: '每次 AI 消息生成花费 1 个代币',
    tokensNeverExpireItem: '代币永不过期',
    securePaymentsStripe: '由 Stripe 处理的安全付款',
    instantDelivery: '即时发货到您的账户',
    pack: '套餐',
    bonusPercent25: '25% 奖励',
    bonusPercent50: '50% 奖励',
    aiConversations: 'AI 对话',
    optional: '可选',
    // Notifications page localization - Chinese
    stayUpdatedAccount: '了解您的账户活动和系统公告',
    notificationsFaq: '通知常见问题',
    howManageNotifications: '如何管理通知？',
    howManageNotificationsAnswer: '您可以按类型过滤通知，将其标记为已读，或单独删除。使用设置来自定义您的通知偏好。',
    whyGettingNotifications: '为什么我会收到通知？',
    whyGettingNotificationsAnswer: '我们会为重要的账户活动（如付款、系统更新和管理员公告）发送通知，以保持您的了解。',
    canDisableNotifications: '我可以禁用通知吗？',
    canDisableNotificationsAnswer: '是的，您可以在设置中自定义通知偏好。您可以选择要接收哪些类型的通知。',
    howLongNotificationsStored: '通知会存储多久？',
    howLongNotificationsStoredAnswer: '通知默认保存 30 天。一些重要通知可能会保存更久以供您参考。',
    viewAll: '查看全部',
    overview: '概览',
    history: '历史',
    language: '语言',
    noMessagesYet: '还没有消息。开始对话吧！',
    todaysChatTime: '今日聊天时间',
    totalCharacters: '角色总数',
    short: '短',
    long: '长',
    precise: '精确',
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
    balance: '余额',
    purchaseTokens: '购买代币',
    transactionHistory: '交易历史',
    usageStats: '使用统计',
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
    buyMoreTokens: '购买更多代币',
    viewHistory: '查看历史',
    upgradeNow: '立即升级',
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
    quickBuy: '快速购买',
    viewPlans: '查看套餐',
    page: '第',
    of: '页 共',
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
    manageAccount: '管理您的账户并查看您的活动',
    recentActivity: '最近活动',
    achievementLevel: '成就等级',
    conversationExpert: '对话专家',
    startedChatWith: '开始与',
    unlockedAchievement: '解锁成就',
    conversationalist: '对话达人',
    explored: '探索了',
    newCharacters: '个新角色',
    memberSince: '成员于',
    quickActions: '快速操作',
    customizeExperience: '自定义您的体验',
    manageAISettings: '管理AI设置、偏好和隐私',
    privacyPreferences: '和隐私',
    getContinue: '获取更多代币',
    continueConversations: '继续对话',
    purchaseTokenPackages: '购买代币包，畅享无限聊天',
    unlimitedChats: '无限聊天',
    languageSettings: '语言设置',
    aiSettings: 'AI设置',
    contentSafety: '内容和安全',
    dataPrivacy: '数据和隐私',
    accountActions: '账户操作',
    customizeAIChat: '自定义您的AI聊天体验',
    applicationPreferences: '和应用偏好',
    interfaceChat: '界面和聊天语言',
    controlsContextWindow: '控制AI记住多少对话历史',
    conversationHistory: '对话历史',
    aiRemembers: 'AI记住',
    higherValues: '较高数值使回复',
    moreCreative: '更有创意',
    unpredictable: '和不可预测',
    allowAI: '允许AI',
    rememberContext: '记住上下文',
    acrossConversations: '跨对话',
    controlsLevel: '控制级别',
    matureContent: '成人内容',
    allowedConversations: '在对话中允许',
    recentlyUsedSettings: '您最近使用的',
    yourRecentlyUsed: '您最近使用的',
    conversationSettings: '对话设置',
    manageToken: '管理您的代币',
    balancePurchase: '余额，购买',
    historyUsage: '历史和使用',
    clearHistory: '清除历史',
    exportOptions: '导出选项',
    subscriptionLogout: '订阅和退出',
    functionality: '功能',
    clearAllChat: '清除所有聊天',
    historyAction: '历史？此操作',
    cannotUndone: '无法撤销',
    permanentlyDelete: '并将永久删除',
    allConversations: '您的所有对话',
    areYouSure: '您确定要',
    wantLogout: '退出登录吗？',
    signOut: '这将使您退出账户',
    redirectHome: '并重定向到首页',
    hoursAgo: '小时前',
    dayAgo: '1天前',
    daysAgo: '天前',
    fromYesterday: '比昨天',
    getMoreTokens: '获取更多代币',
    loading: '加载中...',
    currentlyChatting: '正在聊天',
    recentConversations: '最近对话',
    characterInfo: '角色信息',
    startNewChat: '开始新聊天',
    chatSettings: '聊天设置',
    commands: '命令',
    tone: '语调',
    markdownSupported: '支持Markdown',
    kindSupportive: '友善支持的回复',
    funLighthearted: '有趣轻松的语调',
    seriousDramatic: '严肃戏剧化',
    characterThinks: '角色内心想法',
    characterWhispers: '角色轻声低语',
    characterPerforms: '角色执行动作',
    hide: '隐藏',
    show: '显示',
    basicInfo: '基本信息',
    personality: '性格',
    details: '详情',
    essentialDetails: '关于您角色的基本详情',
    characterAvatar: '角色头像',
    uploading: '上传中...',
    uploadAvatar: '上传头像',
    pngJpgUpTo5MB: 'PNG、JPG格式，最大5MB',
    characterName: '角色名称',
    enterCharacterName: '输入角色名称',
    shortDescription: '简短描述',
    briefDescription: '角色的简要描述（1-2句话）',
    detailedBackstory: '详细的背景故事和背景信息',
    category: '类别',
    personalityTraits: '性格特点',
    selectTraits: '选择定义您角色性格的特点',
    characterTraits: '角色特征',
    personalityDimensions: '性格维度',
    characterDetails: '角色详情',
    additionalInformation: '关于您角色的其他信息',
    genderExample: '例如：男性、女性、非二元',
    age: '年龄',
    ageExample: '例如：25、年轻成人、古老',
    occupation: '职业',
    charactersJob: '角色的工作或职位',
    catchphrase: '口头禅',
    memorablePhrase: '您角色经常说的一句难忘的话',
    conversationStyle: '对话风格',
    publishingSettings: '发布设置',
    configureSharing: '配置您的角色如何被分享',
    makePublic: '公开',
    allowOthersDiscover: '允许其他人发现并与您的角色聊天',
    contentRating: '内容评级',
    safe: '安全',
    mild: '轻微',
    moderate: '中等',
    mature: '成人',
    saveDraft: '保存草稿',
    howCharacterAppears: '您的角色将如何呈现给其他人',
    characterNameRequired: '角色名称是必需的',
    characterDescriptionRequired: '角色描述是必需的',
    characterBackstoryRequired: '角色背景故事是必需的',
    atLeastOneTrait: '至少需要一个特征',
    invalidFileType: '无效的文件类型',
    selectImageFile: '请选择图片文件',
    fileTooLarge: '文件太大',
    selectSmallerImage: '请选择小于5MB的图片',
    uploadFailed: '上传失败',
    failedToUploadAvatar: '上传头像失败。请重试。',
    authenticationRequired: '需要身份验证',
    characterCreatedSuccessfully: '角色创建成功！',
    pleaseLoginToCreate: '请登录以创建角色',
    tokenBalance: '代币余额',
    failedToLoadBalance: '加载余额失败',
    tokens: '代币',
    runningLowTokens: '您的代币不足。每条AI消息需要1个代币。',
    lastUpdated: '最后更新',
    clearFilters: '清除筛选',
    total: '总计',
    discoverPage: '发现',
    exploreTrendingCharacters: '探索热门角色、新上线角色和个性化推荐',
    switchToMasonryLayout: '切换到瀑布流布局',
    switchToGridLayout: '切换到网格布局',
    exploreTypes: '探索类型',
    allCharacters: '所有角色',
    fantasyMagic: '奇幻魔法',
    sciFiFuture: '科幻未来',
    adventureAction: '冒险动作',
    romanceDrama: '浪漫剧情',
    mysteryThriller: '悬疑惊悚',
    modernLifestyle: '现代生活',
    creativeArts: '创意艺术',
    gamingVirtual: '游戏虚拟',
    animeManga: '动漫',
    moviesTv: '影视',
    noCharactersFoundInCategory: '未找到{category}角色',
    tryExploringOtherCategories: '试试其他分类或稍后查看新增内容',
    featuredCharacters: '精选角色',
    handpickedSelections: '精心挑选',
    trendingThisWeek: '本周热门',
    hotPicksCommunity: '社区热选',
    newArrivals: '新上线',
    freshCharactersAdded: '最新添加的角色',
    mostPopular: '最受欢迎',
    communityFavorites: '社区最爱',
    recommendedForYou: '为您推荐',
    basedOnPreferences: '基于您的偏好',
    tryExploringOther: '试试其他分类或稍后查看新增内容',
    viewAllCharacters: '查看所有角色',
    friendly: '友好',
    mysterious: '神秘',
    intelligent: '智慧',
    funny: '幽默',
    serious: '严肃',
    caring: '关爱',
    adventurous: '冒险',
    shy: '害羞',
    confident: '自信',
    creative: '创意',
    logical: '逻辑',
    emotional: '情感',
    brave: '勇敢',
    cautious: '谨慎',
    optimistic: '乐观',
    pessimistic: '悲观',
    loyal: '忠诚',
    independent: '独立',
    playful: '顽皮',
    wise: '智慧',
    curious: '好奇',
    passionate: '热情',
    calm: '冷静',
    energetic: '活力',
    romantic: '浪漫',
    practical: '实用',
    friendliness: '友好度',
    intelligence: '智力',
    humor: '幽默感',
    confidence: '自信度',
    empathy: '共情能力',
    creativity: '创造力',
    casual: '随意',
    formal: '正式',
    mystical: '神秘',
    dramatic: '戏剧性',
    humorous: '幽默',
    professional: '专业',
    sarcastic: '讽刺',
    detailedResponses: '详细回应',
    conciseResponses: '简洁回应',
    storytelling: '讲故事',
    interactive: '互动式',
    questionFocused: '问题导向',
    analytical: '分析型',
    modern: '现代',
    historical: '历史',
    tokenManagement: '代币管理',
    pleaseLoginToManageTokens: '请登录以管理您的代币',
    exportData: '导出数据',
    buyTokens: '购买代币',
    statistics: '统计',
    tokenTips: '代币小贴士',
    optimizeUsage: '优化您的使用',
    engageLongerConversations: '进行更长的对话以从每个代币中获得更多价值',
    saveOnBulkPurchases: '批量购买更省钱',
    largerPackagesBetter: '更大的代币包提供更好的单价',
    buyTokensWhenNeeded: '需要时购买代币 - 它们将始终可用',
    tokenPreferences: '代币偏好设置',
    lowBalanceAlerts: '余额低提醒',
    getNotifiedLowBalance: '当您的代币余额较低时接收通知',
    enabled: '已启用',
    autoPurchase: '自动购买',
    automaticallyBuyTokens: '当余额低时自动购买代币',
    disabled: '已禁用',
    usageAnalytics: '使用分析',
    trackDetailedUsage: '跟踪详细的使用模式和洞察',
    paymentSettings: '支付设置',
    defaultPaymentMethod: '默认支付方式',
    preferredPackage: '首选套餐',
    updatePaymentSettings: '更新支付设置',
    securityNotice: '安全提示',
    purchaseMoreTokens: '购买更多代币',
    viewTransactionHistory: '查看交易历史',
    chatWithAICharacters: '与AI角色聊天',
    tokensLabel: '代币',
    searchCharacters: '搜索角色...',
    upgradePlan: '升级套餐',
    freePlan: '免费套餐',
    profile: '个人资料',
    myChats: '我的聊天',
    tokensBilling: '代币和账单',
    logout: '退出登录',
    login: '登录',
    guest: '游客',
    home: '首页',
    recentChats: '最近聊天',
    favorites: '收藏',
    discover: '发现',
    createCharacter: '创建角色',
    aboutUs: '关于我们',
    faq: '常见问题',
    blog: '博客',
    navigation: '导航',
    expandSidebar: '展开侧边栏',
    collapseSidebar: '收起侧边栏',
    errorLoading: '加载出错',
    notLoggedIn: '未登录',
    membership: '会员',
    leaderboard: '排行榜',
    user: '用户',
    privacyPolicy: '隐私政策',
    termsOfUse: '使用条款',
    copyright: '© 2024 ProductInsightAI',
    updated: '更新',
    discoverAICharacters: '发现精彩的AI角色，开启沉浸式对话',
    immersiveConversations: '开启沉浸式对话',
    popular: '热门',
    recent: '最近',
    trending: '趋势',
    new: '最新',
    following: '关注',
    editorChoice: '编辑推荐',
    gender: '性别',
    all: '全部',
    male: '男性',
    female: '女性',
    anime: '动漫',
    game: '游戏',
    movie: '电影',
    book: '书籍',
    original: '原创',
    fantasy: '奇幻',
    sciFi: '科幻',
    romance: '浪漫',
    action: '动作',
    chatNow: '立即聊天',
    preview: '预览',
    noFavoritesYet: '还没有收藏',
    noCharactersFound: '未找到角色',
    startExploring: '开始探索角色并将它们添加到收藏夹',
    tryAdjustingSearch: '尝试调整搜索词或筛选条件',
    noCharactersMatch: '没有角色符合当前筛选条件',
    errorLoadingCharacters: '加载角色出错，请重试。',
    about: '关于',
    traits: '特征',
    voiceStyle: '语音风格',
    natural: '自然',
    chats: '聊天',
    removeFromFavorites: '从收藏中移除',
    addToFavorites: '添加到收藏',
    noDescriptionAvailable: '暂无描述。',
    myFavorites: '我的收藏',
    charactersCount: '个角色',
    switchToListView: '切换到列表视图',
    switchToGridView: '切换到网格视图',
    searchFavoriteCharacters: '搜索你收藏的角色...',
    sortByDate: '按日期排序',
    sortByName: '按名称排序',
    sortByRating: '按评分排序',
    sortAscending: '升序排列',
    sortDescending: '降序排列',
    noMatchingFavorites: '没有匹配的收藏',
    tryAdjustingFilters: '尝试调整搜索或筛选条件',
    exploreCharacters: '探索角色',
    creating: '创建中...',
    adventure: '冒险',
    mystery: '悬疑',
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