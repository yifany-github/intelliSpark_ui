#!/bin/bash

# Production Build Script for ProductInsightAI MVP
# Builds both frontend and backend for production deployment
# Supports Cloudflare Pages + Fly.io + Supabase + Redis architecture

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting MVP production build...${NC}"

# Check if required environment variables are set
check_env_var() {
    if [ -z "${!1}" ]; then
        echo -e "${RED}❌ Error: $1 environment variable is not set${NC}"
        exit 1
    fi
}

echo -e "${YELLOW}📋 Checking environment variables...${NC}"

# Frontend environment variables
check_env_var "VITE_API_BASE_URL"
check_env_var "VITE_FIREBASE_API_KEY"
check_env_var "VITE_STRIPE_PUBLISHABLE_KEY"

# Optional but recommended
if [ -z "$VITE_SENTRY_DSN" ]; then
    echo -e "${YELLOW}⚠️  Warning: VITE_SENTRY_DSN not set (error monitoring disabled)${NC}"
fi

echo -e "${GREEN}✅ Environment variables check passed${NC}"

# Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm ci

# Run linting and type checking
echo -e "${YELLOW}🔍 Running code quality checks...${NC}"
npm run check

# Build frontend
echo -e "${YELLOW}🏗️  Building frontend for Cloudflare Pages...${NC}"
npm run build

# Verify build output
if [ -d "dist/public" ]; then
    echo -e "${GREEN}✅ Frontend build completed successfully${NC}"
    echo -e "${GREEN}   📁 Build output: dist/public${NC}"
    
    # Show build statistics
    BUILD_SIZE=$(du -sh dist/public | cut -f1)
    ASSET_COUNT=$(find dist/public -type f | wc -l)
    JS_COUNT=$(find dist/public -name "*.js" | wc -l)
    CSS_COUNT=$(find dist/public -name "*.css" | wc -l)
    
    echo -e "${GREEN}   📊 Build size: $BUILD_SIZE${NC}"
    echo -e "${GREEN}   📄 Total files: $ASSET_COUNT${NC}"
    echo -e "${GREEN}   🔧 JavaScript files: $JS_COUNT${NC}"
    echo -e "${GREEN}   🎨 CSS files: $CSS_COUNT${NC}"
    
    # Check for critical files
    if [ -f "dist/public/index.html" ]; then
        echo -e "${GREEN}   ✅ index.html found${NC}"
    else
        echo -e "${RED}   ❌ index.html missing${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ Frontend build failed - dist/public directory not found${NC}"
    exit 1
fi

# Check backend deployment readiness
if [ -d "backend" ]; then
    echo -e "${YELLOW}🔍 Checking backend deployment readiness...${NC}"
    
    # Check backend requirements
    if [ -f "backend/requirements.txt" ]; then
        echo -e "${GREEN}   ✅ requirements.txt found${NC}"
    else
        echo -e "${RED}   ❌ requirements.txt not found${NC}"
        exit 1
    fi
    
    # Check backend Dockerfile
    if [ -f "backend/Dockerfile" ]; then
        echo -e "${GREEN}   ✅ Dockerfile found${NC}"
    else
        echo -e "${RED}   ❌ Dockerfile not found${NC}"
        exit 1
    fi
    
    # Check Fly.io configuration
    if [ -f "backend/fly.toml" ]; then
        echo -e "${GREEN}   ✅ fly.toml found${NC}"
    else
        echo -e "${RED}   ❌ fly.toml not found${NC}"
        exit 1
    fi
    
    # Check health endpoint
    if grep -q "/api/health" backend/*.py; then
        echo -e "${GREEN}   ✅ Health endpoint configured${NC}"
    else
        echo -e "${YELLOW}   ⚠️  Health endpoint not found in Python files${NC}"
    fi
    
    echo -e "${GREEN}✅ Backend is ready for Fly.io deployment${NC}"
else
    echo -e "${RED}❌ Backend directory not found${NC}"
    exit 1
fi

# Check deployment configuration files
echo -e "${YELLOW}🔍 Checking deployment configurations...${NC}"

# GitHub Actions
if [ -f ".github/workflows/deploy-frontend.yml" ]; then
    echo -e "${GREEN}   ✅ Frontend deployment workflow found${NC}"
else
    echo -e "${YELLOW}   ⚠️  Frontend deployment workflow missing${NC}"
fi

if [ -f ".github/workflows/deploy-backend.yml" ]; then
    echo -e "${GREEN}   ✅ Backend deployment workflow found${NC}"
else
    echo -e "${YELLOW}   ⚠️  Backend deployment workflow missing${NC}"
fi

# Docker Compose for local testing
if [ -f "docker-compose.yml" ]; then
    echo -e "${GREEN}   ✅ Docker Compose configuration found${NC}"
else
    echo -e "${YELLOW}   ⚠️  Docker Compose configuration missing${NC}"
fi

echo -e "${GREEN}🎉 MVP production build completed successfully!${NC}"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}📋 MVP Deployment Checklist${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}🌐 Frontend (Cloudflare Pages):${NC}"
echo "   1. Upload dist/public to Cloudflare Pages"
echo "   2. Set VITE_* environment variables in Pages settings"
echo "   3. Configure custom domain and SSL"
echo ""
echo -e "${YELLOW}🚀 Backend (Fly.io):${NC}"
echo "   1. cd backend && flyctl deploy --remote-only"
echo "   2. Set production environment variables: flyctl secrets set KEY=value"
echo "   3. Scale: flyctl scale count 1-3 (auto-scaling configured)"
echo ""
echo -e "${YELLOW}🗃️  Database (Supabase):${NC}"
echo "   1. Create Supabase project"
echo "   2. Run migrations and seed data"
echo "   3. Set DATABASE_URL secret in Fly.io"
echo ""
echo -e "${YELLOW}⚡ Cache (Upstash Redis):${NC}"
echo "   1. Create Upstash Redis database"
echo "   2. Set REDIS_URL secret in Fly.io"
echo ""
echo -e "${YELLOW}📦 Assets (S3 + CloudFront):${NC}"
echo "   1. Create S3 bucket with proper IAM permissions"
echo "   2. Set up CloudFront distribution"
echo "   3. Configure S3/CloudFront secrets in Fly.io"
echo ""
echo -e "${YELLOW}🔍 Monitoring (Sentry):${NC}"
echo "   1. Create Sentry projects for frontend and backend"
echo "   2. Set VITE_SENTRY_DSN in Cloudflare Pages"
echo "   3. Set SENTRY_DSN secret in Fly.io"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎯 Ready for MVP launch!${NC}"