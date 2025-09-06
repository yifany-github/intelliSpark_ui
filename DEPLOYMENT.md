# MVP Deployment Architecture Guide

This guide implements the production-ready MVP deployment architecture as specified in Issue #158.

## Architecture Overview

- **Frontend**: Cloudflare Pages (static build) with global CDN
- **Backend**: Dockerized FastAPI on Fly.io with autoscaling (1-3 instances)
- **Database**: Supabase (managed PostgreSQL)
- **Cache/Queue**: Managed Redis (Upstash/Redis Cloud)
- **Assets**: Amazon S3 + CloudFront for gallery/avatars
- **CI/CD**: GitHub Actions for automated deployments

## Prerequisites

1. **Cloudflare Account** with Pages access
2. **Fly.io Account** for backend hosting
3. **Supabase Account** for managed PostgreSQL
4. **Redis Cloud/Upstash Account** for caching
5. **AWS Account** for S3 + CloudFront (optional for MVP)
6. **GitHub Secrets** configured (see below)

## Environment Setup

### Frontend (.env.production)
```env
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=your-app-id
VITE_API_BASE_URL=https://your-api-domain.fly.dev
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_your_live_stripe_key
VITE_SENTRY_DSN=your_frontend_sentry_dsn
```

### Backend (Fly.io Secrets)
```bash
# Set production secrets in Fly.io
flyctl secrets set SECRET_KEY=your-production-jwt-secret
flyctl secrets set ADMIN_PASSWORD=your-strong-admin-password   # temporary until Admin JWT (Issue #159)
flyctl secrets set GEMINI_API_KEY=your-gemini-api-key
flyctl secrets set DATABASE_URL=your-supabase-postgres-url
flyctl secrets set REDIS_URL=your-redis-url
flyctl secrets set STRIPE_SECRET_KEY=sk_live_your_stripe_secret
flyctl secrets set STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
flyctl secrets set ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
flyctl secrets set FIREBASE_API_KEY=your-firebase-api-key
```

## GitHub Secrets Configuration

Configure these secrets in your GitHub repository:

### Frontend Deployment
- `CLOUDFLARE_API_TOKEN`: Your Cloudflare API token
- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID
- `CLOUDFLARE_PROJECT_NAME`: Your Pages project name
- `VITE_FIREBASE_API_KEY`: Firebase configuration
- `VITE_FIREBASE_AUTH_DOMAIN`: Firebase configuration
- `VITE_FIREBASE_PROJECT_ID`: Firebase configuration
- `VITE_FIREBASE_STORAGE_BUCKET`: Firebase configuration
- `VITE_FIREBASE_MESSAGING_SENDER_ID`: Firebase configuration
- `VITE_FIREBASE_APP_ID`: Firebase configuration
- `VITE_API_BASE_URL`: Production backend URL
- `VITE_STRIPE_PUBLISHABLE_KEY`: Stripe publishable key
- `VITE_SENTRY_DSN`: Frontend Sentry DSN

### Backend Deployment
- `FLY_API_TOKEN`: Your Fly.io API token

## Deployment Steps

### 1. Backend Deployment (Fly.io)

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login to Fly.io
flyctl auth login

# Navigate to backend directory
cd backend

# Initialize Fly.io app (if not done)
flyctl launch --no-deploy

# Set production secrets
flyctl secrets set SECRET_KEY=your-production-jwt-secret
flyctl secrets set GEMINI_API_KEY=your-gemini-api-key
flyctl secrets set DATABASE_URL=your-supabase-postgres-url
# ... (set all other secrets from above)

# Deploy
flyctl deploy
```

### 2. Database Setup (Supabase)

1. Create a new Supabase project
2. Copy the PostgreSQL connection URL
3. Run database migrations:
```bash
# Set DATABASE_URL to your Supabase URL
export DATABASE_URL=your-supabase-postgres-url
cd backend
python -m alembic upgrade head  # If using Alembic
# OR
python database.py  # If using SQLAlchemy create_all()
```

### 3. Frontend Deployment (Cloudflare Pages)

1. Connect your GitHub repository to Cloudflare Pages
2. Set build settings:
   - **Build command**: `npm run build`
   - **Build output directory**: `dist/public`
   - **Root directory**: `/` (project root)
3. Configure environment variables in Cloudflare Pages dashboard
4. Deploy automatically via GitHub Actions

### 4. Redis Setup (Optional)

1. Create a Redis Cloud or Upstash instance
2. Copy the connection URL
3. Set `REDIS_URL` in Fly.io secrets
4. The backend will automatically use Redis for SlowAPI rate limiting if `REDIS_URL` is set; otherwise it falls back to in-memory limits

## Security Checklist

- [ ] HTTPS everywhere (enforced by Cloudflare Pages + Fly.io)
- [ ] CORS allowlist configured for production domains only
- [ ] JWT secrets rotated for production
- [ ] Database connection secured with SSL
- [ ] API rate limiting enabled (via slowapi)
- [ ] Sensitive data never logged or committed
- [ ] Static assets served with security headers

## Monitoring & Observability

### Health Checks
- Backend: `/api/health` endpoint (already implemented)
- Frontend: Served via Cloudflare Pages with 99.9% uptime SLA

### Logging
- Backend: Structured JSON logs via Fly.io
- Frontend: Client-side errors via Sentry (optional)

### Uptime Monitoring
Recommended services:
- Better Uptime
- Pingdom
- StatusCake

## Scaling & Performance

### Backend Autoscaling (Fly.io)
- Configured in `fly.toml`: min 1, max 3 instances
- Auto-suspend when idle, auto-start on demand
- Horizontal scaling based on CPU/memory usage

### Frontend Performance (Cloudflare)
- Global CDN with 200+ edge locations
- Automatic asset optimization
- HTTP/3 and Brotli compression

## Backup Strategy

### Database (Supabase)
- Automated daily backups included
- Point-in-time recovery available
- Manual backup before major deployments

### Assets (S3 - Future)
- S3 lifecycle policies
- Cross-region replication for critical assets
- Weekly cold storage snapshots

## Cost Estimation (Monthly)

- **Fly.io**: ~$5-15/month (shared CPU, auto-scaling)
- **Supabase**: Free tier (up to 500MB), then $25/month
- **Cloudflare Pages**: Free tier (unlimited static sites)
- **Redis**: $5-10/month (managed service)
- **Total**: ~$10-50/month for MVP scale

## Local Development

Use Docker Compose for local development:

```bash
# Copy environment files
cp .env.example .env
cp backend/.env.example backend/.env

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f backend
```

## Troubleshooting

### Common Issues
1. **CORS errors**: Check `ALLOWED_ORIGINS` in backend
2. **Database connection**: Verify Supabase URL and credentials
3. **Build failures**: Check GitHub Actions logs
4. **Health check failures**: Verify `/api/health` endpoint

### Rollback Strategy
- **Frontend**: Redeploy previous commit via Cloudflare Pages
- **Backend**: `flyctl rollback` to previous deployment
- **Database**: Use Supabase dashboard for point-in-time recovery

## Next Steps (Post-MVP)

1. Implement S3 + CloudFront for asset storage
2. Add Redis-based rate limiting and session management
3. Set up comprehensive monitoring with Sentry
4. Implement automated backups and disaster recovery
5. Add load testing and performance optimization
6. Security audit and penetration testing
