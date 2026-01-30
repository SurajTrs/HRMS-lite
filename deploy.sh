#!/bin/bash

# HRMS Lite - Quick Deployment Script
# This script helps you deploy the application step by step

echo "🚀 HRMS Lite Deployment Helper"
echo "================================"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: MongoDB Atlas
echo -e "${BLUE}Step 1: MongoDB Atlas Setup${NC}"
echo "1. Go to https://www.mongodb.com/cloud/atlas"
echo "2. Create a free cluster"
echo "3. Create database user: hrms_admin"
echo "4. Whitelist IP: 0.0.0.0/0"
echo "5. Get connection string"
echo ""
read -p "Have you completed MongoDB setup? (y/n): " mongo_done

if [ "$mongo_done" != "y" ]; then
    echo "Please complete MongoDB setup first!"
    exit 1
fi

read -p "Enter your MongoDB connection string: " MONGODB_URI
echo ""

# Step 2: Backend Deployment
echo -e "${BLUE}Step 2: Backend Deployment (Render)${NC}"
echo "1. Go to https://render.com"
echo "2. Sign up with GitHub"
echo "3. Create new Web Service"
echo "4. Connect your repository"
echo "5. Configure:"
echo "   - Root Directory: backend"
echo "   - Build Command: pip install -r requirements.txt"
echo "   - Start Command: uvicorn main:app --host 0.0.0.0 --port \$PORT"
echo "6. Add Environment Variables:"
echo "   - MONGODB_URI: $MONGODB_URI"
echo "   - PORT: 8000"
echo ""
read -p "Have you deployed backend? (y/n): " backend_done

if [ "$backend_done" != "y" ]; then
    echo "Please deploy backend first!"
    exit 1
fi

read -p "Enter your backend URL (e.g., https://hrms-backend.onrender.com): " BACKEND_URL
echo ""

# Step 3: Update Frontend Environment
echo -e "${BLUE}Step 3: Updating Frontend Configuration${NC}"
cd frontend
echo "VITE_API_URL=$BACKEND_URL" > .env.production
echo -e "${GREEN}✓ Frontend environment configured${NC}"
echo ""

# Step 4: Frontend Deployment
echo -e "${BLUE}Step 4: Frontend Deployment (Vercel)${NC}"
echo "Installing Vercel CLI..."
npm install -g vercel

echo ""
echo "Deploying to Vercel..."
echo "Follow the prompts:"
echo "  - Set up and deploy: Y"
echo "  - Link to existing project: N"
echo "  - Project name: hrms-lite"
echo ""
read -p "Press Enter to start Vercel deployment..."

vercel --prod

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo "Your application is now live!"
echo ""
echo "📝 Next Steps:"
echo "1. Test your backend: $BACKEND_URL/health"
echo "2. View API docs: $BACKEND_URL/docs"
echo "3. Access your frontend: Check Vercel output above"
echo "4. Seed database (optional): cd backend && python seed_database.py"
echo ""
echo "📚 For detailed instructions, see DEPLOYMENT_GUIDE.md"
