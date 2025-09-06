#!/bin/bash

# S3 + CloudFront Setup Script for ProductInsightAI Assets
# This script provides commands to set up AWS S3 and CloudFront for asset storage

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📦 S3 + CloudFront Setup for ProductInsightAI${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not installed${NC}"
    echo -e "${YELLOW}Install it with: pip install awscli${NC}"
    exit 1
fi

echo -e "${GREEN}✅ AWS CLI found${NC}"

# Configuration variables
BUCKET_NAME=${1:-"productinsightai-assets"}
REGION=${2:-"us-east-1"}
CLOUDFRONT_ORIGIN_ACCESS_CONTROL_NAME="productinsightai-oac"

echo -e "${YELLOW}🔧 Configuration:${NC}"
echo "   Bucket Name: $BUCKET_NAME"
echo "   Region: $REGION"
echo ""

# Step 1: Create S3 Bucket
echo -e "${YELLOW}📦 Step 1: Creating S3 Bucket${NC}"
echo "Run the following command to create the S3 bucket:"
echo ""
echo -e "${BLUE}aws s3 mb s3://$BUCKET_NAME --region $REGION${NC}"
echo ""

# Step 2: Configure S3 Bucket Policy
echo -e "${YELLOW}🔐 Step 2: S3 Bucket Policy${NC}"
echo "Create bucket policy file (s3-bucket-policy.json):"

cat > s3-bucket-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Service": "cloudfront.amazonaws.com"
            },
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::$BUCKET_NAME/*",
            "Condition": {
                "StringEquals": {
                    "AWS:SourceArn": "arn:aws:cloudfront::<ACCOUNT_ID>:distribution/<DISTRIBUTION_ID>"
                }
            }
        }
    ]
}
EOF

echo "Apply the bucket policy (replace <ACCOUNT_ID> and <DISTRIBUTION_ID>):"
echo ""
echo -e "${BLUE}aws s3api put-bucket-policy --bucket $BUCKET_NAME --policy file://s3-bucket-policy.json${NC}"
echo ""

# Step 3: Configure CORS
echo -e "${YELLOW}🌐 Step 3: CORS Configuration${NC}"
echo "Create CORS configuration file (s3-cors.json):"

cat > s3-cors.json << EOF
{
    "CORSRules": [
        {
            "AllowedHeaders": ["*"],
            "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
            "AllowedOrigins": [
                "https://yourdomain.com",
                "https://www.yourdomain.com",
                "http://localhost:5173",
                "http://localhost:3000"
            ],
            "ExposeHeaders": ["ETag"],
            "MaxAgeSeconds": 3000
        }
    ]
}
EOF

echo "Apply CORS configuration:"
echo ""
echo -e "${BLUE}aws s3api put-bucket-cors --bucket $BUCKET_NAME --cors-configuration file://s3-cors.json${NC}"
echo ""

# Step 4: Create IAM User and Policy
echo -e "${YELLOW}👤 Step 4: IAM User Setup${NC}"
echo "Create IAM policy file (s3-access-policy.json):"

cat > s3-access-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:PutObjectAcl",
                "s3:GetObject",
                "s3:DeleteObject"
            ],
            "Resource": "arn:aws:s3:::$BUCKET_NAME/*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:ListBucket"
            ],
            "Resource": "arn:aws:s3:::$BUCKET_NAME"
        }
    ]
}
EOF

echo "Create IAM policy and user:"
echo ""
echo -e "${BLUE}aws iam create-policy --policy-name ProductInsightAI-S3Access --policy-document file://s3-access-policy.json${NC}"
echo -e "${BLUE}aws iam create-user --user-name productinsightai-s3-user${NC}"
echo -e "${BLUE}aws iam attach-user-policy --user-name productinsightai-s3-user --policy-arn arn:aws:iam::<ACCOUNT_ID>:policy/ProductInsightAI-S3Access${NC}"
echo -e "${BLUE}aws iam create-access-key --user-name productinsightai-s3-user${NC}"
echo ""

# Step 5: CloudFront Distribution
echo -e "${YELLOW}☁️  Step 5: CloudFront Distribution${NC}"
echo "Create CloudFront distribution configuration (cloudfront-distribution.json):"

cat > cloudfront-distribution.json << EOF
{
    "CallerReference": "productinsightai-$(date +%s)",
    "Comment": "ProductInsightAI Assets Distribution",
    "Origins": {
        "Quantity": 1,
        "Items": [
            {
                "Id": "$BUCKET_NAME-origin",
                "DomainName": "$BUCKET_NAME.s3.$REGION.amazonaws.com",
                "OriginPath": "",
                "S3OriginConfig": {
                    "OriginAccessIdentity": ""
                },
                "OriginAccessControlId": "<OAC_ID>"
            }
        ]
    },
    "DefaultCacheBehavior": {
        "TargetOriginId": "$BUCKET_NAME-origin",
        "ViewerProtocolPolicy": "redirect-to-https",
        "TrustedSigners": {
            "Enabled": false,
            "Quantity": 0
        },
        "ForwardedValues": {
            "QueryString": false,
            "Cookies": {
                "Forward": "none"
            }
        },
        "MinTTL": 0,
        "DefaultTTL": 86400,
        "MaxTTL": 31536000,
        "Compress": true
    },
    "Enabled": true,
    "PriceClass": "PriceClass_100"
}
EOF

echo "Create Origin Access Control (OAC):"
echo ""
echo -e "${BLUE}aws cloudfront create-origin-access-control --origin-access-control-config Name=$CLOUDFRONT_ORIGIN_ACCESS_CONTROL_NAME,Description=\"OAC for ProductInsightAI\",OriginAccessControlOriginType=s3,SigningBehavior=always,SigningProtocol=sigv4${NC}"
echo ""
echo "Create CloudFront distribution (update <OAC_ID> first):"
echo ""
echo -e "${BLUE}aws cloudfront create-distribution --distribution-config file://cloudfront-distribution.json${NC}"
echo ""

# Step 6: Environment Variables
echo -e "${YELLOW}🔧 Step 6: Environment Variables${NC}"
echo "Add these environment variables to your backend .env file:"
echo ""
echo -e "${GREEN}# S3 Configuration${NC}"
echo -e "${GREEN}AWS_ACCESS_KEY_ID=<your_access_key_id>${NC}"
echo -e "${GREEN}AWS_SECRET_ACCESS_KEY=<your_secret_access_key>${NC}"
echo -e "${GREEN}AWS_REGION=$REGION${NC}"
echo -e "${GREEN}S3_BUCKET=$BUCKET_NAME${NC}"
echo ""
echo -e "${GREEN}# CloudFront Configuration${NC}"
echo -e "${GREEN}CLOUDFRONT_DISTRIBUTION_ID=<your_distribution_id>${NC}"
echo -e "${GREEN}CLOUDFRONT_DOMAIN=<your_cloudfront_domain>${NC}"
echo ""

# Step 7: Fly.io Secrets
echo -e "${YELLOW}🚁 Step 7: Fly.io Secrets${NC}"
echo "Set secrets in Fly.io:"
echo ""
echo -e "${BLUE}flyctl secrets set AWS_ACCESS_KEY_ID=<your_access_key_id>${NC}"
echo -e "${BLUE}flyctl secrets set AWS_SECRET_ACCESS_KEY=<your_secret_access_key>${NC}"
echo -e "${BLUE}flyctl secrets set AWS_REGION=$REGION${NC}"
echo -e "${BLUE}flyctl secrets set S3_BUCKET=$BUCKET_NAME${NC}"
echo -e "${BLUE}flyctl secrets set CLOUDFRONT_DISTRIBUTION_ID=<your_distribution_id>${NC}"
echo ""

# Cleanup
echo -e "${YELLOW}🧹 Cleanup${NC}"
echo "The following configuration files have been created:"
echo "   - s3-bucket-policy.json"
echo "   - s3-cors.json"
echo "   - s3-access-policy.json"
echo "   - cloudfront-distribution.json"
echo ""
echo -e "${YELLOW}Remember to:${NC}"
echo "   1. Replace <ACCOUNT_ID> with your AWS Account ID"
echo "   2. Replace <DISTRIBUTION_ID> after creating CloudFront distribution"
echo "   3. Replace <OAC_ID> with the Origin Access Control ID"
echo "   4. Update your production domains in CORS configuration"
echo "   5. Store access keys securely and never commit them to git"
echo ""
echo -e "${GREEN}🎉 S3 + CloudFront setup guide complete!${NC}"