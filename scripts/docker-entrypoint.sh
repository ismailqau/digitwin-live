#!/bin/sh
# Docker entrypoint script for Cloud Run services
# Constructs DATABASE_URL from individual components including secrets

set -e

# Construct DATABASE_URL if not already set and components are available
if [ -z "$DATABASE_URL" ] && [ -n "$DATABASE_HOST" ] && [ -n "$DATABASE_USER" ] && [ -n "$DATABASE_PASSWORD" ] && [ -n "$DATABASE_NAME" ]; then
    # For Cloud SQL Unix socket connections, construct a simple DATABASE_URL
    # The socket path is /cloudsql/PROJECT:REGION:INSTANCE
    # PostgreSQL will automatically look for .s.PGSQL.5432 in that directory
    
    # Extract just the connection name (remove /cloudsql/ prefix if present)
    SOCKET_DIR=$(echo "${DATABASE_HOST}" | sed 's|^/cloudsql/||')
    
    # Construct DATABASE_URL using the socket directory
    # Format: postgresql://USER:PASSWORD@/DATABASE?host=/cloudsql/CONNECTION_NAME
    export DATABASE_URL="postgresql://${DATABASE_USER}:${DATABASE_PASSWORD}@localhost/${DATABASE_NAME}?host=/cloudsql/${SOCKET_DIR}"
    
    echo "✅ DATABASE_URL constructed for Cloud SQL Unix socket"
    echo "   Socket directory: /cloudsql/${SOCKET_DIR}"
    echo "   Database: ${DATABASE_NAME}"
    echo "   User: ${DATABASE_USER}"
fi

# Execute the main command
exec "$@"
