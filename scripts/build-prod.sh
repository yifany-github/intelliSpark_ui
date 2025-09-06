#!/bin/bash

# Production build script for ProductInsightAI

set -e  # Exit on any error

echo "🏗️  Building ProductInsightAI for production..."

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo "⚠️  Warning: .env.production not found. Using default .env"
    echo "   Make sure to create .env.production for production builds"
fi

# Build frontend
echo "📦 Building frontend..."
npm run build

# Validate build output
if [ ! -d "dist/public" ]; then
    echo "❌ Build failed: dist/public directory not found"
    exit 1
fi

echo "✅ Build completed successfully!"
echo "📊 Build stats:"
du -sh dist/public
find dist/public -name "*.js" -o -name "*.css" | wc -l | xargs echo "  Static assets:"
echo "  Build output: dist/public"

echo ""
echo "🚀 Ready for deployment!"
echo "   Frontend: dist/public"
echo "   Backend: backend/ (containerized)"