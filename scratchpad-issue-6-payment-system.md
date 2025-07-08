# Issue #6: Basic Payment System (Stripe Only)

**Issue Link**: https://github.com/YongBoYu1/intelliSpark_ui/issues/6

## Problem Analysis

The goal is to implement a basic token-based payment system using Stripe for international users. Users will purchase tokens which get deducted when generating AI responses.

## Current State Analysis

1. **Database**: No token/payment tables exist
2. **Backend**: No payment endpoints or Stripe integration
3. **Frontend**: No payment UI components
4. **Dependencies**: 
   - Frontend: No Stripe dependencies installed
   - Backend: No Stripe Python SDK installed

## Implementation Plan

### Phase 1: Backend Database & Models (30 mins)

1. **Create UserToken Model** (`backend/models.py`)
   - `id`: Primary key
   - `user_id`: Foreign key to users table
   - `balance`: Integer (token count)
   - `created_at`: Timestamp
   - `updated_at`: Timestamp

2. **Create TokenTransaction Model** (`backend/models.py`)
   - `id`: Primary key
   - `user_id`: Foreign key to users table
   - `transaction_type`: String ('purchase', 'deduction', 'refund')
   - `amount`: Integer (positive for purchase/refund, negative for deduction)
   - `description`: String
   - `stripe_payment_intent_id`: String (optional, for purchases)
   - `created_at`: Timestamp

3. **Update Schemas** (`backend/schemas.py`)
   - `UserTokenBalance`: For API responses
   - `TokenPurchaseRequest`: For purchase requests
   - `TokenPurchaseResponse`: For purchase responses

### Phase 2: Stripe Integration (45 mins)

1. **Install Dependencies**
   - Backend: `stripe` Python SDK
   - Frontend: `@stripe/stripe-js` and `@stripe/react-stripe-js`

2. **Create Stripe Service** (`backend/payment/stripe_service.py`)
   - Initialize Stripe with secret key
   - Create payment intent function
   - Handle webhook events (payment success/failure)

3. **Create Payment Routes** (`backend/payment/routes.py`)
   - `POST /api/payment/create-payment-intent`: Create Stripe payment intent
   - `POST /api/payment/confirm-payment`: Confirm payment and add tokens
   - `POST /api/payment/webhook`: Handle Stripe webhooks
   - `GET /api/user/tokens`: Get user token balance

### Phase 3: Token Deduction Logic (30 mins)

1. **Modify AI Generation** (`backend/gemini_service.py`)
   - Check user token balance before generating response
   - Deduct tokens after successful generation
   - Return error if insufficient tokens

2. **Token Management Service** (`backend/payment/token_service.py`)
   - Functions to check balance, deduct tokens, add tokens
   - Transaction logging

### Phase 4: Frontend Payment UI (60 mins)

1. **Payment Page** (`client/src/pages/payment/index.tsx`)
   - Display pricing tiers
   - Integrate Stripe Elements for card payment
   - Handle payment flow

2. **Token Balance Component** (`client/src/components/payment/TokenBalance.tsx`)
   - Display current token balance
   - Link to payment page

3. **Update Navigation** (`client/src/components/layout/TabNavigation.tsx`)
   - Add payment/billing tab (optional)

### Phase 5: Testing & Integration (30 mins)

1. **Test Stripe Integration**
   - Use Stripe test cards
   - Test successful payments
   - Test failed payments

2. **Test Token Deduction**
   - Verify tokens are deducted on AI generation
   - Test insufficient balance handling

3. **End-to-End Testing**
   - Purchase tokens → Generate AI responses → Verify deduction

## File Structure

```
backend/
├── models.py (updated)
├── schemas.py (updated)
├── payment/
│   ├── __init__.py
│   ├── stripe_service.py (new)
│   ├── token_service.py (new)
│   └── routes.py (new)
├── gemini_service.py (updated)
└── requirements.txt (updated)

client/src/
├── pages/
│   └── payment/
│       └── index.tsx (new)
├── components/
│   └── payment/
│       └── TokenBalance.tsx (new)
└── package.json (updated)
```

## Environment Variables

### Backend (.env)
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Frontend (.env)
```
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

## Pricing Tiers (Initial)

1. **Starter**: $5 → 100 tokens
2. **Standard**: $20 → 500 tokens (25% bonus)
3. **Premium**: $50 → 1500 tokens (50% bonus)

## Token Costs

- AI Message Generation: 1 token per message

## Success Criteria

- [ ] Users can purchase tokens via Stripe
- [ ] Token balance is tracked per user
- [ ] Tokens are deducted on AI generation
- [ ] Payment page is functional and secure
- [ ] Token balance is displayed in UI
- [ ] Stripe test cards work correctly
- [ ] Error handling for insufficient balance
- [ ] Transaction logging for debugging

## Estimated Timeline

- **Total**: 3 hours
- **Phase 1**: 30 minutes
- **Phase 2**: 45 minutes
- **Phase 3**: 30 minutes
- **Phase 4**: 60 minutes
- **Phase 5**: 30 minutes

## Risk Mitigation

1. **Security**: Use Stripe webhooks to confirm payments, never trust client-side
2. **Testing**: Thoroughly test with Stripe test cards before production
3. **Error Handling**: Graceful handling of payment failures and insufficient balance
4. **User Experience**: Clear messaging about token costs and balance