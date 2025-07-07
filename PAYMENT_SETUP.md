# Payment System Setup Guide

This document explains how to set up and test the token-based payment system with Stripe integration.

## Prerequisites

1. **Stripe Account**: You need a Stripe account to get API keys
2. **Test Mode**: Use Stripe test mode for development and testing

## Environment Variables

### Backend (.env)
Add the following to `backend/.env`:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

### Frontend (.env)
Add the following to the root directory `.env`:

```bash
# Stripe Configuration  
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here
```

## Getting Stripe API Keys

1. Sign up for a [Stripe account](https://stripe.com/)
2. Go to your Stripe Dashboard
3. Navigate to "Developers" > "API keys"
4. Copy your **Publishable key** and **Secret key** (make sure you're in test mode)
5. For webhooks, go to "Developers" > "Webhooks" and create a new endpoint

## Database Setup

The payment system adds new tables to the database:

- `user_tokens`: Stores user token balances
- `token_transactions`: Stores transaction history

These tables will be created automatically when you start the backend.

## Testing the Payment System

### 1. Install Dependencies

**Backend:**
```bash
cd backend
pip install -r requirements.txt
```

**Frontend:**
```bash
npm install
```

### 2. Run Tests

**Basic API Tests:**
```bash
cd backend
python test_api.py
```

**Manual Testing with Stripe Test Cards:**

Use these test card numbers in the payment form:
- **Success**: 4242 4242 4242 4242
- **Decline**: 4000 0000 0000 0002
- **Insufficient funds**: 4000 0000 0000 9995

### 3. Webhook Testing

For local development, use Stripe CLI to forward webhooks:

```bash
# Install Stripe CLI
# https://stripe.com/docs/stripe-cli

# Login to Stripe
stripe login

# Forward events to your local server
stripe listen --forward-to localhost:8000/api/payment/webhook
```

This will give you a webhook secret to use in your `.env` file.

## Payment Flow

1. **User views pricing**: `/payment` page shows available token packages
2. **Payment processing**: Stripe handles secure payment processing
3. **Webhook confirmation**: Stripe webhook confirms payment success
4. **Token addition**: System adds tokens to user's balance
5. **Token usage**: Tokens are deducted for AI message generation

## Token Economics

- **Cost per AI message**: 1 token
- **Pricing tiers**:
  - Starter: $5.00 → 100 tokens
  - Standard: $20.00 → 500 tokens (25% bonus)
  - Premium: $50.00 → 1500 tokens (50% bonus)

## Security Features

- All payments processed by Stripe (PCI compliant)
- No card details stored on our servers
- Webhook signature verification
- Token balance stored server-side
- Authentication required for all payment endpoints

## Troubleshooting

### Common Issues

1. **Payment fails**: Check Stripe dashboard for error details
2. **Tokens not added**: Verify webhook is working and receiving events
3. **Authentication errors**: Ensure user is logged in before making payments
4. **Environment variables**: Double-check all Stripe keys are correct

### Error Codes

- **402 Payment Required**: User has insufficient tokens
- **401 Unauthorized**: User not authenticated
- **400 Bad Request**: Invalid payment data
- **500 Internal Server Error**: Server configuration issue

## Production Deployment

1. Switch to Stripe live mode keys
2. Set up production webhook endpoint
3. Configure SSL certificate for webhook security
4. Set appropriate CORS origins
5. Monitor payment success rates and errors

## Support

For payment-related issues:
1. Check Stripe Dashboard for transaction details
2. Review server logs for error messages
3. Test with Stripe test cards first
4. Verify webhook events are being received