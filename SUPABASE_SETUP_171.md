# Supabase Setup Guide - Issue #171

This guide covers provisioning Supabase Postgres and connecting it to the ProductInsightAI backend deployed on Fly.io.

## Prerequisites

1. Supabase account (https://supabase.com)
2. Fly.io CLI installed and authenticated
3. Backend already deployed on Fly.io (app: `productinsightai-backend`)

## Step 1: Create Supabase Project

1. Go to https://supabase.com/dashboard
2. Click "New project"
3. Choose organization and enter project details:
   - **Name**: `productinsightai-db`
   - **Database Password**: Generate a secure password (save this!)
   - **Region**: Choose closest to Fly.io region (`iad` - East US)
4. Wait for project provisioning (2-3 minutes)

## Step 2: Get Database Connection String

1. In Supabase dashboard, go to **Settings** → **Database**
2. Scroll to "Connection string" section
3. Copy the **Connection pooling** URI (recommended for production):
   ```
   postgresql://postgres.PROJECT_ID:PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres
   ```
4. Replace `PASSWORD` with your database password from Step 1

**Example format:**
```
DATABASE_URL=postgresql://postgres.abcdefghij:your_password_here@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

## Step 3: Set Database URL in Fly Secrets

Update the Fly.io app with the Supabase connection string:

```bash
# Set the DATABASE_URL secret
fly secrets set DATABASE_URL="postgresql://postgres.PROJECT_ID:PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres" -a productinsightai-backend

# Verify secrets (DATABASE_URL should be listed)
fly secrets list -a productinsightai-backend
```

## Step 4: Deploy and Test Backend

```bash
# Deploy backend with new database configuration
fly deploy -a productinsightai-backend

# Check logs to ensure successful startup
fly logs -a productinsightai-backend

# Test health endpoint
curl https://productinsightai-backend.fly.dev/api/health
```

## Step 5: Verify Database Setup

The backend will automatically:

1. **Create tables** using SQLAlchemy models on startup
2. **Seed initial data** including default characters (艾莉丝, Kravus, Lyra, XN-7)

### Verification Steps:

```bash
# Check database logs during startup
fly logs -a productinsightai-backend --tail

# Test API endpoints to verify database connectivity
curl https://productinsightai-backend.fly.dev/api/characters
```

### Expected Log Output:
```
Database URL: postgresql://postgres.PROJECT_ID:...
[startup] Database tables created successfully
[startup] Initial data seeded: 4 characters created
```

## Step 6: Supabase Dashboard Verification

1. Go to **Table Editor** in Supabase dashboard
2. Verify these tables exist:
   - `users`
   - `characters`
   - `chats`
   - `chat_messages`
   - `user_tokens`
   - `token_transactions`
   - `notifications`
   - `character_gallery_images`

3. Check `characters` table has 4 initial characters seeded

## Security Configuration (Optional)

### Row Level Security (RLS)
For production, consider enabling RLS in Supabase:

1. Go to **Authentication** → **Policies**
2. Enable RLS on sensitive tables
3. Create policies based on user authentication

### SSL Configuration
- SSL is enabled by default with Supabase connection strings
- No additional configuration needed

## Troubleshooting

### Connection Issues
```bash
# Check if DATABASE_URL is set correctly
fly secrets list -a productinsightai-backend

# View detailed logs
fly logs -a productinsightai-backend --tail
```

### Common Errors

1. **"password authentication failed"**
   - Verify password in DATABASE_URL matches Supabase project password
   - Check for special characters that need URL encoding

2. **"could not connect to server"**
   - Verify PROJECT_ID in connection string
   - Ensure region matches (e.g., `aws-0-us-east-1`)

3. **"tables not created"**
   - Check SQLAlchemy model imports in `models.py`
   - Verify `init_db()` is called in `main.py` startup event

## Rollback Plan

If issues occur:

```bash
# Switch back to SQLite (for testing only)
fly secrets unset DATABASE_URL -a productinsightai-backend
fly deploy -a productinsightai-backend
```

## Completion Checklist

- [x] Supabase project created
- [x] Postgres connection URL (SSL) copied: `aws-1-ca-central-1.pooler.supabase.com:6543`
- [x] Backend boots and auto-creates tables (9 tables verified)
- [x] Seed data present (4 initial characters: 艾莉丝, Kravus, Lyra, XN-7)

## ✅ Issue #171 Status: COMPLETED

**Supabase Setup Successful!**
- **Database**: PostgreSQL with SSL 
- **Tables**: All 9 required tables created automatically
- **Seed Data**: 4 default characters loaded
- **Connection**: Tested and working via connection pooling

## Next Steps

After successful setup:
1. Monitor database performance in Supabase dashboard
2. Set up automated backups (enabled by default)
3. Consider implementing Row Level Security policies
4. Update frontend API base URL if needed

---

**References:**
- Issue #158: MVP Deployment Architecture
- Issue #171: Supabase Provision + Init
- Supabase Documentation: https://supabase.com/docs
- Fly.io Secrets: https://fly.io/docs/reference/secrets/