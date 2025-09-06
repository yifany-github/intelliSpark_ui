#!/bin/bash

# Redis Setup Script for ProductInsightAI
# Provides setup instructions for Redis cache/queue services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}⚡ Redis Setup for ProductInsightAI${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo -e "${YELLOW}Redis is used for:${NC}"
echo "   • Rate limiting storage"
echo "   • Session caching"
echo "   • Background job queues"
echo "   • API response caching"
echo ""

echo -e "${YELLOW}📋 Choose your Redis provider:${NC}"
echo ""

# Option 1: Upstash (Recommended)
echo -e "${GREEN}🚀 Option 1: Upstash Redis (Recommended)${NC}"
echo "   ✅ Serverless Redis with global replication"
echo "   ✅ Free tier: 10K commands per day"
echo "   ✅ Pay-as-you-go scaling"
echo "   ✅ REST API support"
echo ""
echo -e "${BLUE}Setup steps:${NC}"
echo "   1. Go to https://console.upstash.com"
echo "   2. Create account and new Redis database"
echo "   3. Choose region (us-east-1 recommended for Fly.io)"
echo "   4. Copy connection details"
echo ""
echo -e "${YELLOW}Configuration:${NC}"
echo "   REDIS_URL=redis://default:<password>@<host>:<port>"
echo ""

# Option 2: Redis Cloud
echo -e "${GREEN}☁️  Option 2: Redis Cloud${NC}"
echo "   ✅ Managed Redis by Redis Inc."
echo "   ✅ Free tier: 30MB storage"
echo "   ✅ Enterprise features available"
echo "   ✅ Multi-cloud support"
echo ""
echo -e "${BLUE}Setup steps:${NC}"
echo "   1. Go to https://redis.com/try-free/"
echo "   2. Create account and subscription"
echo "   3. Create new database"
echo "   4. Configure security (VPC/IP whitelist)"
echo ""
echo -e "${YELLOW}Configuration:${NC}"
echo "   REDIS_URL=redis://default:<password>@<host>:<port>"
echo ""

# Option 3: AWS ElastiCache
echo -e "${GREEN}🏢 Option 3: AWS ElastiCache${NC}"
echo "   ✅ Fully managed Redis"
echo "   ✅ VPC integration"
echo "   ✅ Backup and failover"
echo "   ⚠️  More complex setup"
echo ""
echo -e "${BLUE}Setup steps:${NC}"
echo "   1. Create ElastiCache Redis cluster"
echo "   2. Configure security groups and subnets"
echo "   3. Set up VPC peering (if needed)"
echo "   4. Get cluster endpoint"
echo ""

# Local Development
echo -e "${YELLOW}🔧 Local Development Setup${NC}"
echo ""
echo -e "${BLUE}Using Docker (recommended):${NC}"
echo "   docker run -d -p 6379:6379 --name redis redis:7-alpine"
echo ""
echo -e "${BLUE}Using Docker Compose (already configured):${NC}"
echo "   docker-compose up -d redis"
echo ""
echo -e "${BLUE}Using Homebrew (macOS):${NC}"
echo "   brew install redis"
echo "   brew services start redis"
echo ""
echo -e "${BLUE}Using APT (Ubuntu/Debian):${NC}"
echo "   sudo apt update"
echo "   sudo apt install redis-server"
echo "   sudo systemctl start redis-server"
echo ""

# Environment Configuration
echo -e "${YELLOW}🔧 Environment Configuration${NC}"
echo ""
echo -e "${GREEN}Development (.env):${NC}"
echo "   REDIS_URL=redis://localhost:6379"
echo ""
echo -e "${GREEN}Production (Fly.io secrets):${NC}"
echo "   flyctl secrets set REDIS_URL=redis://default:<password>@<host>:<port>"
echo ""

# Testing Connection
echo -e "${YELLOW}🧪 Testing Redis Connection${NC}"
echo ""
echo -e "${BLUE}Using redis-cli:${NC}"
echo "   redis-cli -u redis://default:<password>@<host>:<port> ping"
echo ""
echo -e "${BLUE}Using Python:${NC}"
cat << 'EOF'
```python
import redis
import os

redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
r = redis.from_url(redis_url)

try:
    r.ping()
    print("✅ Redis connection successful")
except Exception as e:
    print(f"❌ Redis connection failed: {e}")
```
EOF
echo ""

# Security Considerations
echo -e "${YELLOW}🔐 Security Checklist${NC}"
echo ""
echo "   □ Use strong passwords"
echo "   □ Enable TLS/SSL in production"
echo "   □ Restrict network access (IP whitelist/VPC)"
echo "   □ Use AUTH command for authentication"
echo "   □ Disable dangerous commands (FLUSHALL, CONFIG, etc.)"
echo "   □ Monitor access logs"
echo "   □ Set up alerts for unusual activity"
echo ""

# Performance Optimization
echo -e "${YELLOW}⚡ Performance Tips${NC}"
echo ""
echo "   • Use connection pooling"
echo "   • Set appropriate TTL values"
echo "   • Use pipelining for bulk operations"
echo "   • Monitor memory usage"
echo "   • Configure eviction policies"
echo "   • Use Redis Cluster for scaling"
echo ""

# Monitoring
echo -e "${YELLOW}📊 Monitoring & Maintenance${NC}"
echo ""
echo "   • Monitor memory usage and hit rates"
echo "   • Set up alerts for high memory usage"
echo "   • Monitor connection counts"
echo "   • Regular performance analysis"
echo "   • Backup critical data (if needed)"
echo ""

# Integration with ProductInsightAI
echo -e "${YELLOW}🔌 Integration with ProductInsightAI${NC}"
echo ""
echo -e "${GREEN}Rate Limiting:${NC}"
echo "   • Store rate limit counters per IP/user"
echo "   • Implement sliding window rate limiting"
echo ""
echo -e "${GREEN}Session Storage:${NC}"
echo "   • Cache user sessions and preferences"
echo "   • Store temporary authentication tokens"
echo ""
echo -e "${GREEN}API Caching:${NC}"
echo "   • Cache AI model responses"
echo "   • Cache character data and prompts"
echo ""
echo -e "${GREEN}Background Jobs:${NC}"
echo "   • Queue image processing tasks"
echo "   • Queue email notifications"
echo "   • Queue analytics data processing"
echo ""

echo -e "${GREEN}🎉 Redis setup guide complete!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "   1. Choose a Redis provider"
echo "   2. Set up Redis instance"
echo "   3. Configure REDIS_URL environment variable"
echo "   4. Test connection"
echo "   5. Deploy to production"