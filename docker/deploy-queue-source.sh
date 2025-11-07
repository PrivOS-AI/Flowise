#!/bin/bash

############################################################################################################
# Flowise Queue Mode Deployment Script
#
# This script deploys Flowise in queue mode, building from source code
# Use this when you've modified the source code and want to deploy your changes
#
# Usage:
#   ./deploy-queue-source.sh [command]
#
# Commands:
#   start       - Build and start containers
#   stop        - Stop containers
#   restart     - Restart containers
#   rebuild     - Force rebuild and restart
#   logs        - View logs
#   status      - Check container status
#   clean       - Stop and remove containers, volumes, and images
#
############################################################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose-queue-source.yml"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

# Determine which env file to use (prefer .local with actual secrets)
if [ -f "$PROJECT_DIR/.env.queue-source.local" ]; then
    ENV_FILE=".env.queue-source.local"
else
    ENV_FILE=".env.queue-source"
fi

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi

    if [ ! -f "$PROJECT_DIR/$ENV_FILE" ]; then
        log_error "Environment file not found: $ENV_FILE"

        if [ "$ENV_FILE" = ".env.queue-source.local" ]; then
            log_info "Creating .env.queue-source.local from template..."
            if [ -f "$PROJECT_DIR/.env.queue-source" ]; then
                cp "$PROJECT_DIR/.env.queue-source" "$PROJECT_DIR/.env.queue-source.local"
                log_success "Created $ENV_FILE"
                log_warning "Please edit $ENV_FILE with your secrets before deploying!"
                log_info "At minimum, change:"
                log_info "  - JWT_AUTH_TOKEN_SECRET"
                log_info "  - JWT_REFRESH_TOKEN_SECRET"
                log_info "  - DATABASE credentials (if using PostgreSQL)"
            else
                log_error "Template file .env.queue-source not found!"
            fi
        fi
        exit 1
    fi

    log_success "Using environment file: $ENV_FILE"

    log_success "Prerequisites check passed"
}

# Start containers
start_containers() {
    log_info "Starting Flowise in Queue Mode (building from source)..."

    cd "$PROJECT_DIR"
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up --build -d

    log_success "Containers started!"
    log_info "Main server: http://localhost:3000"
    log_info "BullMQ Dashboard: http://localhost:3000/admin/queues (if enabled)"
    log_info ""
    log_info "View logs: $0 logs"
    log_info "Check status: $0 status"
}

# Stop containers
stop_containers() {
    log_info "Stopping containers..."

    cd "$PROJECT_DIR"
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down

    log_success "Containers stopped"
}

# Restart containers
restart_containers() {
    log_info "Restarting containers..."

    cd "$PROJECT_DIR"
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" restart

    log_success "Containers restarted"
}

# Rebuild containers (zero-downtime approach)
rebuild_containers() {
    log_info "Rebuilding containers from source (no cache)..."
    log_info "Building new images (includes pnpm install for dependencies)..."
    log_info "Current containers are still running - no downtime yet..."

    cd "$PROJECT_DIR"

    # Build new images FIRST (old containers still running - no downtime yet)
    # This runs: COPY source → pnpm install → rebuild native modules
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build --no-cache

    if [ $? -ne 0 ]; then
        log_error "Build failed! Old containers are still running."
        exit 1
    fi

    log_success "New images built successfully (dependencies installed)"
    log_info "Swapping to new containers (brief downtime)..."

    # Quick swap: stop old, start new (minimal downtime)
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --force-recreate --no-build

    log_success "Containers rebuilt and started with minimal downtime"
}

# View logs
view_logs() {
    log_info "Viewing logs (Ctrl+C to exit)..."

    cd "$PROJECT_DIR"
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs -f
}

# Check status
check_status() {
    log_info "Container status:"
    echo ""

    cd "$PROJECT_DIR"
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps

    echo ""
    log_info "Docker images:"
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" images
}

# Clean everything
clean_all() {
    log_warning "This will remove all containers, volumes, and images!"
    read -p "Are you sure? (yes/no): " -r
    echo

    if [[ $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        log_info "Cleaning up..."

        cd "$PROJECT_DIR"
        docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down -v --rmi all

        log_success "Cleanup complete"
    else
        log_info "Cleanup cancelled"
    fi
}

# Git pull and deploy (zero-downtime approach)
pull_and_deploy() {
    log_info "Pulling latest code from git..."

    cd "$PROJECT_DIR/.."

    if [ -d ".git" ]; then
        git pull
        log_success "Code updated"

        log_info "Building new images (includes pnpm install for dependencies)..."
        log_info "Current containers are still running - no downtime yet..."
        cd "$PROJECT_DIR"

        # Build new images FIRST (old containers still running)
        # This runs: COPY source → pnpm install → rebuild native modules
        docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build --no-cache

        if [ $? -ne 0 ]; then
            log_error "Build failed! Old containers are still running. Rolling back git changes..."
            cd "$PROJECT_DIR/.."
            git reset --hard HEAD@{1}
            exit 1
        fi

        log_success "New images built successfully (dependencies installed)"
        log_info "Swapping to new containers (brief downtime)..."

        # Quick swap: stop old, start new (minimal downtime)
        docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --force-recreate --no-build

        log_success "Deployment complete with minimal downtime!"
    else
        log_error "Not a git repository"
        exit 1
    fi
}

# Scale workers
scale_workers() {
    if [ -z "$2" ]; then
        log_error "Please specify number of workers: $0 scale <number>"
        exit 1
    fi

    log_info "Scaling workers to $2 instances..."

    cd "$PROJECT_DIR"
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --scale flowise-worker="$2"

    log_success "Workers scaled to $2"
}

# Show help
show_help() {
    cat << EOF
${BLUE}Flowise Queue Mode Deployment Script${NC}

${GREEN}Usage:${NC}
  $0 [command]

${GREEN}Commands:${NC}
  ${YELLOW}start${NC}       - Build and start containers
  ${YELLOW}stop${NC}        - Stop containers
  ${YELLOW}restart${NC}     - Restart containers without rebuilding
  ${YELLOW}rebuild${NC}     - Force rebuild from source (minimal downtime)
  ${YELLOW}logs${NC}        - View real-time logs (Ctrl+C to exit)
  ${YELLOW}status${NC}      - Check container status
  ${YELLOW}deploy${NC}      - Git pull + rebuild + restart (minimal downtime)
  ${YELLOW}scale <N>${NC}   - Scale workers to N instances
  ${YELLOW}clean${NC}       - Stop and remove containers, volumes, and images
  ${YELLOW}help${NC}        - Show this help message

${GREEN}Examples:${NC}
  $0 start                # Start Flowise
  $0 logs                 # View logs
  $0 deploy               # Pull latest code and deploy
  $0 scale 3              # Run 3 worker instances
  $0 rebuild              # Force complete rebuild

${GREEN}Files:${NC}
  Config: ${YELLOW}$ENV_FILE${NC}
  Compose: ${YELLOW}$COMPOSE_FILE${NC}

${GREEN}Endpoints:${NC}
  Main API: ${BLUE}http://localhost:3000${NC}
  Queue Dashboard: ${BLUE}http://localhost:3000/admin/queues${NC}

${GREEN}Tips:${NC}
  • Edit $ENV_FILE before first run
  • Use PostgreSQL for production (not SQLite)
  • Scale workers based on load: $0 scale 5
  • View logs to debug issues: $0 logs
  • 'rebuild' and 'deploy' build new images BEFORE stopping old containers
    (minimal downtime - only during container swap)

EOF
}

# Main script
main() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}   Flowise Queue Mode - Source Build Deployment${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
    echo ""

    case "${1:-help}" in
        start)
            check_prerequisites
            start_containers
            ;;
        stop)
            stop_containers
            ;;
        restart)
            restart_containers
            ;;
        rebuild)
            check_prerequisites
            rebuild_containers
            ;;
        logs)
            view_logs
            ;;
        status)
            check_status
            ;;
        deploy)
            check_prerequisites
            pull_and_deploy
            ;;
        scale)
            scale_workers "$@"
            ;;
        clean)
            clean_all
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "Unknown command: $1"
            echo ""
            show_help
            exit 1
            ;;
    esac

    echo ""
}

# Run main
main "$@"
