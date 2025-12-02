# Terraform Backend Setup

## Quick Start

### For Testing (Local Backend)

```bash
pnpm tf:init-local
```

State stored locally. Good for testing.

### For Production (GCS Backend)

```bash
# Create GCS bucket (done by gcp-setup.sh)
pnpm gcp:setup

# Initialize
pnpm tf:init
```

State stored in GCS. Good for teams.

## Problem: "Enter bucket name"

If Terraform asks for bucket name:

**Solution 1: Use local backend**

```bash
pnpm tf:init-local
```

**Solution 2: Create GCS bucket**

```bash
pnpm gcp:setup  # Creates digitwinlive-terraform-state-{env}
pnpm tf:init
```

## Commands

```bash
# Initialize
pnpm tf:init              # GCS backend
pnpm tf:init-local        # Local backend

# Plan/Apply
pnpm tf:plan              # All resources
pnpm tf:plan-monitoring   # Monitoring only
pnpm tf:apply-monitoring  # Deploy monitoring

# Utilities
pnpm tf:validate          # Check config
pnpm tf:fmt               # Format files
```

## Backend Files

- `backend-dev.hcl` - Development GCS backend
- `backend-prod.hcl` - Production GCS backend

## Cost

- **Local backend**: $0/month
- **GCS backend**: < $0.03/month

## Related

- [Monitoring Guide](../../docs/MONITORING.md)
- [GCP Management](../../docs/GCP-MANAGEMENT.md)
