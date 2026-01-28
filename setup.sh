#!/bin/bash

# GMAO Installation Script
# Automates the setup process for first-time installation

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Main installation
main() {
    print_header "GMAO - Installation Wizard"
    
    # Check prerequisites
    print_header "Checking Prerequisites"
    
    if ! command_exists docker; then
        print_error "Docker is not installed"
        print_info "Please install Docker from: https://docs.docker.com/get-docker/"
        exit 1
    fi
    print_success "Docker found: $(docker --version)"
    
    if ! command_exists docker-compose && ! docker compose version >/dev/null 2>&1; then
        print_error "Docker Compose is not installed"
        print_info "Please install Docker Compose from: https://docs.docker.com/compose/install/"
        exit 1
    fi
    if command_exists docker-compose; then
        print_success "Docker Compose found: $(docker-compose --version)"
    else
        print_success "Docker Compose found: $(docker compose version)"
    fi
    
    if ! command_exists git; then
        print_warning "Git is not installed (optional for cloning)"
    else
        print_success "Git found: $(git --version)"
    fi
    
    # Check if .env exists
    print_header "Configuration Setup"
    
    if [ -f .env ]; then
        print_warning ".env file already exists"
        read -p "Do you want to overwrite it? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "Using existing .env file"
        else
            cp .env.example .env
            print_success "Created new .env from template"
        fi
    else
        if [ ! -f .env.example ]; then
            print_error ".env.example not found"
            exit 1
        fi
        cp .env.example .env
        print_success "Created .env from template"
    fi
    
    # Generate secure passwords and secrets
    print_header "Generating Secure Credentials"
    
    if command_exists openssl; then
        POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
        JWT_SECRET=$(openssl rand -hex 64)
        
        # Update .env file
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=${POSTGRES_PASSWORD}/" .env
            sed -i '' "s/DB_PASSWORD=.*/DB_PASSWORD=${POSTGRES_PASSWORD}/" .env
            sed -i '' "s/JWT_SECRET=.*/JWT_SECRET=${JWT_SECRET}/" .env
        else
            # Linux
            sed -i "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=${POSTGRES_PASSWORD}/" .env
            sed -i "s/DB_PASSWORD=.*/DB_PASSWORD=${POSTGRES_PASSWORD}/" .env
            sed -i "s/JWT_SECRET=.*/JWT_SECRET=${JWT_SECRET}/" .env
        fi
        
        print_success "Generated secure PostgreSQL password"
        print_success "Generated secure JWT secret"
    else
        print_error "OpenSSL not found - cannot generate secure credentials automatically"
        print_warning "You MUST manually update the following in .env file:"
        print_warning "  - POSTGRES_PASSWORD (and DB_PASSWORD to match)"
        print_warning "  - JWT_SECRET"
        print_info "Generate secure password: head -c 32 /dev/urandom | base64 | tr -d '=+/' | cut -c1-32"
        print_info "Generate JWT secret: head -c 64 /dev/urandom | base64 | tr -d '=+/'"
        read -p "Press Enter to continue after updating .env, or Ctrl+C to exit..."
    fi
    
    # Ask about environment
    print_header "Environment Configuration"
    read -p "Is this for production? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s/NODE_ENV=.*/NODE_ENV=production/" .env
        else
            sed -i "s/NODE_ENV=.*/NODE_ENV=production/" .env
        fi
        print_warning "Production mode enabled"
        print_warning "Make sure to configure CORS_ORIGIN in .env for your domain!"
        COMPOSE_FILE="docker-compose.prod.yml"
    else
        print_info "Development mode"
        COMPOSE_FILE="docker-compose.yml"
    fi
    
    # Start services
    print_header "Starting Services"
    
    print_info "Pulling Docker images..."
    docker compose -f "$COMPOSE_FILE" pull
    
    print_info "Building containers..."
    docker compose -f "$COMPOSE_FILE" build
    
    print_info "Starting containers..."
    docker compose -f "$COMPOSE_FILE" up -d
    
    print_success "Containers started"
    
    # Wait for services
    print_header "Waiting for Services"
    
    print_info "Waiting for PostgreSQL to be ready..."
    COUNTER=0
    MAX_TRIES=30
    while ! docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U postgres >/dev/null 2>&1; do
        sleep 2
        COUNTER=$((COUNTER + 1))
        if [ $COUNTER -ge $MAX_TRIES ]; then
            print_error "PostgreSQL failed to start"
            docker compose -f "$COMPOSE_FILE" logs postgres
            exit 1
        fi
    done
    print_success "PostgreSQL is ready"
    
    print_info "Waiting for backend to be ready..."
    COUNTER=0
    MAX_TRIES=30
    while ! docker compose -f "$COMPOSE_FILE" exec -T backend node -e "require('http').get('http://localhost:5000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" >/dev/null 2>&1; do
        sleep 2
        COUNTER=$((COUNTER + 1))
        if [ $COUNTER -ge $MAX_TRIES ]; then
            print_warning "Backend health check timeout - will attempt migration anyway"
            break
        fi
    done
    if [ $COUNTER -lt $MAX_TRIES ]; then
        print_success "Backend is ready"
    fi
    
    # Initialize database
    print_header "Initializing Database"
    
    print_info "Running database migrations..."
    if docker compose -f "$COMPOSE_FILE" exec -T backend npm run migrate; then
        print_success "Database initialized successfully"
    else
        print_error "Database migration failed"
        print_info "You may need to run manually: docker compose exec backend npm run migrate"
    fi
    
    # Final status
    print_header "Installation Complete!"
    
    echo -e "\n${GREEN}✓ GMAO is now running!${NC}\n"
    
    if [ "$COMPOSE_FILE" = "docker-compose.yml" ]; then
        echo -e "Access the application:"
        echo -e "  ${BLUE}Frontend:${NC}  http://localhost:3010"
        echo -e "  ${BLUE}Backend:${NC}   http://localhost:5010"
        echo -e "  ${BLUE}API Test:${NC}  http://localhost:5010/health"
    else
        echo -e "Access the application:"
        echo -e "  ${BLUE}Frontend:${NC}  http://localhost"
        echo -e "  ${BLUE}Backend:${NC}   http://localhost:5000"
    fi
    
    echo -e "\n${YELLOW}Default Login Credentials:${NC}"
    echo -e "  Email:    admin@gmao.com"
    echo -e "  Password: Admin123!"
    echo -e "\n${RED}⚠ IMPORTANT: Change the admin password after first login!${NC}"
    
    # Show container status
    echo -e "\n${BLUE}Container Status:${NC}"
    docker compose -f "$COMPOSE_FILE" ps
    
    # Useful commands
    echo -e "\n${BLUE}Useful Commands:${NC}"
    echo -e "  View logs:        docker compose -f $COMPOSE_FILE logs -f"
    echo -e "  Stop services:    docker compose -f $COMPOSE_FILE down"
    echo -e "  Restart:          docker compose -f $COMPOSE_FILE restart"
    echo -e "  View status:      docker compose -f $COMPOSE_FILE ps"
    
    echo -e "\n${GREEN}Installation completed successfully!${NC}"
    echo -e "For more information, see: ${BLUE}INSTALLATION_FROM_SCRATCH.md${NC}\n"
}

# Run main function
main "$@"
