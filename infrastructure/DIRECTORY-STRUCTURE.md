# Directory Structure Preservation

This document explains the directory structure and the use of `.gitkeep` files to preserve empty directories in Git.

## Why .gitkeep Files?

Git does not track empty directories. To ensure that important directory structures are preserved in the repository, we use `.gitkeep` files as placeholders. These files:

1. Ensure directories exist when the repository is cloned
2. Document the purpose of each directory
3. Prevent build/runtime errors due to missing directories
4. Maintain consistent structure across environments

## Infrastructure Directories

### Terraform Configuration

```
infrastructure/terraform/
├── .gitkeep                    # Main terraform directory
├── backends/
│   └── .gitkeep               # Backend configuration files
├── environments/
│   └── .gitkeep               # Environment-specific variables
└── modules/
    └── .gitkeep               # Reusable Terraform modules
```

**Purpose**: Preserve Terraform infrastructure-as-code structure

### Deployment Scripts

```
infrastructure/scripts/
└── .gitkeep                    # Deployment and management scripts
```

**Purpose**: Ensure scripts directory exists for automation

## Application Directories

### API Gateway

```
apps/api-gateway/
├── logs/
│   └── .gitkeep               # Application logs (runtime)
└── uploads/
    └── .gitkeep               # Temporary file uploads
```

**Purpose**:

- `logs/`: Store application logs at runtime
- `uploads/`: Temporary storage for user-uploaded files before processing

### WebSocket Server

```
apps/websocket-server/
└── logs/
    └── .gitkeep               # WebSocket server logs (runtime)
```

**Purpose**: Store WebSocket connection and message logs

## Service Directories

### All Services

Each service has a `logs/` directory for runtime logging:

```
services/
├── asr-service/logs/.gitkeep
├── rag-service/logs/.gitkeep
├── llm-service/logs/.gitkeep
├── tts-service/logs/.gitkeep
├── lipsync-service/logs/.gitkeep
└── face-processing-service/logs/.gitkeep
```

### Service-Specific Directories

**TTS Service**:

```
services/tts-service/
└── cache/
    └── .gitkeep               # Audio file cache
```

**Purpose**: Cache generated audio files for performance

**Lip-sync Service**:

```
services/lipsync-service/
└── cache/
    └── .gitkeep               # Video frame cache
```

**Purpose**: Cache generated video frames for performance

**Face Processing Service**:

```
services/face-processing-service/
└── tmp/
    └── .gitkeep               # Temporary processing files
```

**Purpose**: Temporary storage for uploaded images/videos during processing

**RAG Service**:

```
services/rag-service/
└── cache/
    └── .gitkeep               # Embeddings cache
```

**Purpose**: Cache computed embeddings for performance

## .gitignore Configuration

The `.gitignore` file is configured to:

1. **Ignore directory contents** (logs, uploads, cache, tmp)
2. **Preserve .gitkeep files** (using negation patterns)
3. **Ignore sensitive files** (service account keys, secrets)

Example patterns:

```gitignore
# Ignore logs but keep directory structure
logs/
*.log
!logs/.gitkeep

# Ignore uploads but keep directory structure
uploads/
!uploads/.gitkeep

# Ignore cache but keep directory structure
cache/
!cache/.gitkeep
```

## Directory Lifecycle

### Development

1. Clone repository → directories exist (via .gitkeep)
2. Run application → directories populated with runtime files
3. Commit changes → runtime files ignored, .gitkeep preserved

### Production

1. Deploy code → directories exist (via .gitkeep)
2. Application starts → creates logs, cache, etc.
3. Directories persist across deployments

## Best Practices

### When to Add .gitkeep

Add `.gitkeep` files when:

- Directory is required for application to run
- Directory will be populated at runtime
- Directory structure is part of the architecture
- Directory is referenced in code or configuration

### When NOT to Add .gitkeep

Don't add `.gitkeep` when:

- Directory will always have committed files
- Directory is created by build tools (node_modules, dist)
- Directory is temporary and not required

### Naming Convention

We use `.gitkeep` (not `.gitignore` or other names) because:

- It's a widely recognized convention
- It clearly indicates the purpose
- It's hidden by default (starts with `.`)
- It doesn't conflict with Git functionality

## Verification

To verify all required directories exist:

```bash
# Check infrastructure directories
ls -la infrastructure/terraform/
ls -la infrastructure/scripts/

# Check application directories
ls -la apps/api-gateway/logs/
ls -la apps/api-gateway/uploads/
ls -la apps/websocket-server/logs/

# Check service directories
ls -la services/*/logs/
ls -la services/*/cache/
ls -la services/*/tmp/
```

All directories should exist and contain a `.gitkeep` file.

## Maintenance

### Adding New Services

When adding a new service, create these directories:

```bash
# For a new service
mkdir -p services/new-service/logs
echo "# New service logs directory" > services/new-service/logs/.gitkeep

# If service needs cache
mkdir -p services/new-service/cache
echo "# New service cache directory" > services/new-service/cache/.gitkeep
```

### Removing Services

When removing a service:

1. Delete the service directory
2. Update this documentation
3. Verify no references remain in code

## Troubleshooting

### Directory Not Found Error

**Problem**: Application fails with "directory not found" error

**Solution**:

```bash
# Verify .gitkeep exists
ls -la path/to/directory/.gitkeep

# If missing, create it
mkdir -p path/to/directory
echo "# Directory description" > path/to/directory/.gitkeep
git add path/to/directory/.gitkeep
git commit -m "Add missing directory structure"
```

### .gitkeep Files Committed with Content

**Problem**: Runtime files committed alongside .gitkeep

**Solution**:

```bash
# Check .gitignore patterns
cat .gitignore | grep -A 2 "logs/"

# Verify negation pattern exists
# Should see: !logs/.gitkeep

# Remove unwanted files
git rm --cached path/to/unwanted/files
git commit -m "Remove runtime files from Git"
```

## Summary

| Directory Type | Purpose              | .gitkeep Location            | Ignored Content            |
| -------------- | -------------------- | ---------------------------- | -------------------------- |
| Infrastructure | Terraform configs    | `infrastructure/terraform/*` | `*.tfstate`, `.terraform/` |
| Logs           | Runtime logs         | `*/logs/`                    | `*.log`                    |
| Uploads        | Temporary uploads    | `*/uploads/`                 | All files except .gitkeep  |
| Cache          | Performance cache    | `*/cache/`                   | All files except .gitkeep  |
| Temp           | Temporary processing | `*/tmp/`                     | All files except .gitkeep  |

## Related Documentation

- [Infrastructure Setup](./SETUP-GUIDE.md)
- [GCP Infrastructure](../docs/GCP-INFRASTRUCTURE.md)
- [Monorepo Development](../docs/MONOREPO-DEVELOPMENT.md)
