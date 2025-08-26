#!/bin/bash

# 🚂 Railway Deployment Script for WhatsApp Scraper
# This script automates the deployment process

set -e

echo "🚂 Starting Railway Deployment for WhatsApp Scraper..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_dependencies() {
    print_status "Checking dependencies..."
    
    if ! command -v git &> /dev/null; then
        print_error "Git is not installed. Please install Git first."
        exit 1
    fi
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js first."
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm first."
        exit 1
    fi
    
    print_success "All dependencies are installed!"
}

# Check if we're in a git repository
check_git_repo() {
    print_status "Checking Git repository..."
    
    if [ ! -d ".git" ]; then
        print_error "Not in a Git repository. Please initialize Git first:"
        echo "  git init"
        echo "  git add ."
        echo "  git commit -m 'Initial commit'"
        exit 1
    fi
    
    print_success "Git repository found!"
}

# Check if Railway CLI is installed
check_railway_cli() {
    print_status "Checking Railway CLI..."
    
    if ! command -v railway &> /dev/null; then
        print_warning "Railway CLI not found. Installing..."
        npm install -g @railway/cli
        
        if ! command -v railway &> /dev/null; then
            print_error "Failed to install Railway CLI. Please install manually:"
            echo "  npm install -g @railway/cli"
            exit 1
        fi
    fi
    
    print_success "Railway CLI is installed!"
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    
    if [ ! -d "node_modules" ]; then
        npm install
        print_success "Dependencies installed!"
    else
        print_status "Dependencies already installed, updating..."
        npm update
        print_success "Dependencies updated!"
    fi
}

# Build the project
build_project() {
    print_status "Building project..."
    
    # Check if build script exists
    if grep -q '"build"' package.json; then
        npm run build
        print_success "Project built successfully!"
    else
        print_warning "No build script found, skipping build step."
    fi
}

# Test the project locally
test_locally() {
    print_status "Testing project locally..."
    
    # Check if test script exists
    if grep -q '"test"' package.json; then
        print_status "Running tests..."
        npm test
        print_success "Tests passed!"
    else
        print_warning "No test script found, skipping tests."
    fi
    
    # Test health server
    print_status "Testing health server..."
    timeout 10s node health-server.js &
    HEALTH_PID=$!
    
    sleep 3
    
    if curl -s http://localhost:3000/health > /dev/null; then
        print_success "Health server is working!"
        kill $HEALTH_PID 2>/dev/null || true
    else
        print_warning "Health server test failed, but continuing deployment..."
        kill $HEALTH_PID 2>/dev/null || true
    fi
}

# Commit changes
commit_changes() {
    print_status "Committing changes..."
    
    # Check if there are changes to commit
    if git diff --quiet && git diff --cached --quiet; then
        print_status "No changes to commit."
    else
        git add .
        git commit -m "Deploy to Railway - $(date)"
        print_success "Changes committed!"
    fi
}

# Push to remote
push_to_remote() {
    print_status "Pushing to remote repository..."
    
    # Get current branch
    CURRENT_BRANCH=$(git branch --show-current)
    
    # Check if remote exists
    if git remote get-url origin &> /dev/null; then
        git push origin $CURRENT_BRANCH
        print_success "Pushed to remote repository!"
    else
        print_warning "No remote origin found. Please add remote:"
        echo "  git remote add origin <your-repo-url>"
        echo "  git push -u origin $CURRENT_BRANCH"
    fi
}

# Deploy to Railway
deploy_to_railway() {
    print_status "Deploying to Railway..."
    
    # Check if user is logged in to Railway
    if ! railway whoami &> /dev/null; then
        print_warning "Not logged in to Railway. Please login:"
        echo "  railway login"
        exit 1
    fi
    
    # Deploy the project
    railway up
    print_success "Deployed to Railway!"
}

# Show deployment status
show_status() {
    print_status "Checking deployment status..."
    
    # Get Railway project info
    if railway status &> /dev/null; then
        print_success "Deployment completed successfully!"
        echo ""
        echo "🎉 Your WhatsApp Scraper is now running on Railway!"
        echo ""
        echo "📱 Next steps:"
        echo "  1. Check Railway dashboard for logs"
        echo "  2. Scan QR code to connect WhatsApp"
        echo "  3. Test bot functionality"
        echo "  4. Monitor health endpoint"
        echo ""
        echo "🔗 Useful commands:"
        echo "  railway logs          - View deployment logs"
        echo "  railway status        - Check service status"
        echo "  railway open          - Open Railway dashboard"
        echo ""
    else
        print_error "Failed to get deployment status."
    fi
}

# Main deployment function
main() {
    echo "🚂 ========================================"
    echo "🚂 Railway Deployment for WhatsApp Scraper"
    echo "🚂 ========================================"
    echo ""
    
    check_dependencies
    check_git_repo
    check_railway_cli
    install_dependencies
    build_project
    test_locally
    commit_changes
    push_to_remote
    deploy_to_railway
    show_status
    
    echo ""
    print_success "Deployment completed! 🎉"
}

# Run main function
main "$@"
