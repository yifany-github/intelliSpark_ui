# Issue #50: Fix Token Balance Real-Time Synchronization Across UI Components

**GitHub Issue:** https://github.com/yifany-github/intelliSpark_ui/issues/50

## Problem Summary

Token balance displays are not synchronized across the application. When users generate AI responses (costing 1 token), the backend correctly deducts tokens, but frontend components don't refresh their token balance displays until page reload. This creates a confusing user experience where token counts appear incorrect.

**Current behavior**: Generate AI response → Backend deducts 1 token → Frontend shows stale balance  
**Expected behavior**: Generate AI response → Backend deducts 1 token → Frontend immediately shows updated balance

## Root Cause Analysis

### ✅ Backend Token Deduction (Working Correctly)
**File:** `backend/routes.py:285` - Token deduction happens after AI generation
- The backend correctly deducts 1 token after successful AI response generation
- Database is properly updated with new token balance

### ❌ Frontend Query Invalidation (Missing)
**File:** `client/src/pages/chat.tsx:119-122` - AI response mutation success handler
```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: [`/api/chats/${chatId}/messages`] });
  setIsTyping(false);
  // ❌ MISSING: Token balance query invalidation
},
```

### ❌ Inconsistent Query Keys (Multiple Components)
**Files with token balance queries:**
- `client/src/components/layout/TopNavigation.tsx:24` - Uses `['tokenBalance', isAuthenticated]`  
- `client/src/components/layout/GlobalSidebar.tsx:36` - Uses `['tokenBalance', isAuthenticated]`
- `client/src/pages/payment/index.tsx:414` - Uses `['tokenBalance']` (only one that invalidates correctly)

**Issue:** Query key inconsistency prevents proper cache synchronization

## Current Token Service Implementation

**File:** `client/src/services/tokenService.ts`
- ✅ `fetchTokenBalance()` function works correctly
- ❌ Missing invalidation helpers for query cache management
- ❌ No optimistic update functionality

## Implementation Plan

### Phase 1: Enhance Token Service with Cache Management
**Target:** `client/src/services/tokenService.ts`

**Add Query Cache Management Functions:**
```typescript
import { queryClient } from '@/lib/queryClient';

/**
 * Invalidate token balance queries across all components
 * Call this after any operation that changes token balance
 */
export const invalidateTokenBalance = (): void => {
  queryClient.invalidateQueries({ queryKey: ['tokenBalance'] });
};

/**
 * Optimistically update token balance (for immediate UI feedback)
 * @param newBalance - The new token balance to display
 */
export const updateTokenBalanceOptimistically = (newBalance: number): void => {
  queryClient.setQueryData(['tokenBalance'], (oldData: any) => {
    if (oldData?.balance !== undefined) {
      return { ...oldData, balance: newBalance };
    }
    return oldData;
  });
};
```

### Phase 2: Fix AI Response Generation Mutation
**Target:** `client/src/pages/chat.tsx:119-122`

**Add Token Balance Invalidation:**
```typescript
// BEFORE (line 119-122):
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: [`/api/chats/${chatId}/messages`] });
  setIsTyping(false);
},

// AFTER:
import { invalidateTokenBalance, updateTokenBalanceOptimistically } from '@/services/tokenService';

onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: [`/api/chats/${chatId}/messages`] });
  setIsTyping(false);
  
  // ✅ NEW: Invalidate token balance after AI response generation
  invalidateTokenBalance();
},
```

### Phase 3: Add Optimistic Updates (Better UX)
**Target:** Same mutation in `chat.tsx`

**Add Immediate UI Feedback:**
```typescript
// Add token balance query to get current balance
const { data: currentTokens } = useQuery({
  queryKey: ['tokenBalance'],
  queryFn: fetchTokenBalance,
  enabled: isAuthenticated,
});

// Enhance the AI response mutation
const { mutate: aiResponse } = useMutation({
  mutationFn: async () => {
    // ✅ NEW: Optimistically deduct 1 token immediately (before API call)
    if (currentTokens?.balance && currentTokens.balance > 0) {
      updateTokenBalanceOptimistically(currentTokens.balance - 1);
    }
    
    return apiRequest("POST", `/api/chats/${chatId}/generate`, {});
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: [`/api/chats/${chatId}/messages`] });
    setIsTyping(false);
    
    // ✅ Invalidate to get real balance from server (in case of any discrepancy)
    invalidateTokenBalance();
  },
  onError: (error: any) => {
    console.error("AI response generation failed:", error);
    setIsTyping(false);
    
    // ✅ NEW: If generation fails, revert optimistic update
    invalidateTokenBalance();
    
    // ... existing error handling code
  }
});
```

### Phase 4: Fix Query Key Consistency
**Target:** Navigation components

**Standardize Query Keys to `['tokenBalance']`:**

**File:** `client/src/components/layout/TopNavigation.tsx:23-24`
```typescript
// BEFORE:
const { data: tokenBalance, isLoading: tokenLoading, error: tokenError, refetch } = useQuery({
  queryKey: ['tokenBalance', isAuthenticated],  // ❌ Inconsistent
  
// AFTER:
const { data: tokenBalance, isLoading: tokenLoading, error: tokenError, refetch } = useQuery({
  queryKey: ['tokenBalance'],  // ✅ Consistent
```

**File:** `client/src/components/layout/GlobalSidebar.tsx:35-36`
```typescript
// BEFORE:
const { data: tokenBalance, isLoading: tokenLoading, error: tokenError, refetch } = useQuery({
  queryKey: ['tokenBalance', isAuthenticated],  // ❌ Inconsistent
  
// AFTER:
const { data: tokenBalance, isLoading: tokenLoading, error: tokenError, refetch } = useQuery({
  queryKey: ['tokenBalance'],  // ✅ Consistent
```

### Phase 5: Enhanced Error Handling and Loading States
**Target:** Navigation components

**Add Better Error Handling:**
```typescript
// Enhanced display in TopNavigation.tsx and GlobalSidebar.tsx
<span>
  🎯 {t('tokensLabel')}: {
    tokenLoading ? '...' : 
    tokenError ? (
      <button onClick={() => refetch()} className="text-red-500 hover:text-red-400">
        ?
      </button>
    ) : 
    (tokenBalance?.balance ?? '0')
  }
</span>
```

## Files to Modify

### 1. Core Service Enhancement
- **`client/src/services/tokenService.ts`**
  - Add `invalidateTokenBalance()` helper function
  - Add `updateTokenBalanceOptimistically()` for immediate UI feedback
  - Import queryClient for cache management

### 2. Chat Generation Fix
- **`client/src/pages/chat.tsx`**
  - Lines 119-122: Add token balance invalidation to success callback
  - Add optimistic token deduction in mutationFn
  - Add token balance query for current balance
  - Enhance error handling to revert optimistic updates

### 3. Navigation Components Consistency
- **`client/src/components/layout/TopNavigation.tsx`**
  - Line 24: Change query key from `['tokenBalance', isAuthenticated]` to `['tokenBalance']`
  - Enhance error handling for token display

- **`client/src/components/layout/GlobalSidebar.tsx`**
  - Line 36: Same query key consistency fix
  - Same error handling improvements

## Testing Strategy

### Manual Testing Checklist
- [ ] Start a chat with any character  
- [ ] Note initial token balance in both TopNavigation and GlobalSidebar
- [ ] Generate AI response (costs 1 token)
- [ ] **VERIFY**: Token balance decreases immediately in both navigation components
- [ ] **VERIFY**: Balance is consistent across TopNavigation and GlobalSidebar
- [ ] Test with multiple rapid AI generations
- [ ] Test error scenarios (network failures during generation)
- [ ] Test with low token balance (< 5 tokens)

### UI Testing with Puppeteer
```javascript
// Test token balance synchronization
describe('Token Balance Synchronization', () => {
  it('should update token balance immediately after AI generation', async () => {
    // Navigate to chat
    // Note initial token balance in navigation
    // Generate AI response  
    // Assert token balance decreased immediately
    // Assert consistency across navigation components
  });
});
```

### Backend Verification
```bash
# Verify token deduction is working correctly
POST /api/chats/{id}/generate
GET /api/payment/user/tokens  # Check balance decreased
```

## Implementation Steps

### Step 1: Enhance Token Service
- Add invalidation and optimistic update helpers to tokenService.ts
- Import queryClient for cache management
- Test helper functions work correctly

### Step 2: Fix Chat Generation Mutation  
- Add token balance invalidation to success callback
- Add optimistic token deduction for immediate feedback
- Add current token balance query
- Enhance error handling to revert optimistic updates

### Step 3: Fix Navigation Component Query Keys
- Standardize query keys to `['tokenBalance']` in both TopNavigation and GlobalSidebar
- Remove `isAuthenticated` from query key for consistency
- Test that components show same balance

### Step 4: Enhanced Error Handling
- Add better loading and error states for token displays
- Add click-to-refresh for error states
- Test error scenarios

### Step 5: Comprehensive Testing
- Manual testing with multiple rapid AI generations
- UI testing with Puppeteer 
- Error scenario testing
- Performance verification

## Success Criteria

### Must Have:
- [x] Token balance updates immediately after AI response generation
- [x] All navigation components show consistent token balance  
- [x] No page refresh required to see updated balance
- [x] Optimistic updates provide immediate UI feedback
- [x] Error scenarios properly revert optimistic changes
- [x] Query key consistency across all token balance components

### Should Have:
- [x] Smooth loading states during token updates
- [x] Consistent query caching strategy across components
- [x] Prevention of excessive API calls through proper staleTime settings
- [x] Better error handling with click-to-refresh functionality

## Technical Considerations

### Performance Impact
- **Network requests**: No additional requests (just proper cache invalidation)
- **Memory**: Minimal increase for query cache management  
- **CPU**: Negligible impact from cache invalidation operations

### Error Handling Strategy
- Optimistic updates for immediate feedback
- Revert optimistic changes on errors
- Fallback display values for network errors
- Click-to-refresh for error recovery

### Query Caching Strategy
- Consistent query keys: `['tokenBalance']`
- Proper staleTime settings (30 seconds)
- Invalidation after token-consuming operations
- Optimistic updates for better UX

## Commit Strategy

1. **Enhance token service with cache management helpers**
2. **Fix chat generation mutation to invalidate token balance**  
3. **Add optimistic updates for immediate UI feedback**
4. **Standardize query keys across navigation components**
5. **Enhance error handling and loading states**
6. **Add comprehensive testing and documentation**

## Risk Assessment

### Low Risk 🟢
- **Cache invalidation**: Standard TanStack Query pattern
- **Optimistic updates**: Widely used UX pattern  
- **Query key consistency**: Simple refactoring with immediate testing feedback

### Mitigation Strategies
- Test thoroughly with rapid consecutive AI generations
- Implement proper error boundaries for token-related failures
- Add fallback display values for network errors
- Monitor for any performance regressions in navigation components

## Dependencies Status

- ✅ **Payment System**: Already implemented with proper token deduction
- ✅ **TanStack Query**: Cache management system in place
- ✅ **Authentication**: JWT token system working correctly
- ✅ **Token Service**: Basic fetchTokenBalance functionality exists

---

**Created:** 2025-08-01  
**Issue Priority:** High - Core functionality affecting user experience  
**Estimated Effort:** 1-2 days (3-5 story points)
**Labels:** `bug`, `user-experience`, `frontend`, `token-system`