# GCP Rollback Procedures

Comprehensive guide for rolling back deployments and recovering from failures in Google Cloud Platform.

## Table of Contents

- [Overview](#overview)
- [Cloud Run Rollback](#cloud-run-rollback)
- [Database Rollback](#database-rollback)
- [Configuration Rollback](#configuration-rollback)
- [Emergency Procedures](#emergency-procedures)
- [Post-Rollback Verification](#post-rollback-verification)

## Overview

### When to Rollback

Rollback when:

- ✅ New deployment causes critical errors
- ✅ Performance degradation after deployment
- ✅ Data corruption or integrity issues
- ✅ Security vulnerabilities discovered
- ✅ Failed database migration

### Rollback Strategy

1. **Immediate**: Rollback Cloud Run services (< 1 minute)
2. **Database**: Restore from backup if needed (5-30 minutes)
3. **Verify**: Test all critical endpoints
4. **Investigate**: Review logs to identify root cause
5. **Fix**: Address issues in development
6. **Redeploy**: Deploy fixed version after testing

## Cloud Run Rollback

Cloud Run automatically keeps previous revisions, making rollback simple and fast.

### Quick Rollback (Single Service)

```bash
# List revisions to find previous version
gcloud run revisions list \
  --service=api-gateway \
  --region=us-central1 \
  --format="table(name,status,createdAt)"

# Example output:
# NAME                        STATUS  CREATED
# api-gateway-00003-abc       ACTIVE  2024-12-06 10:30:00
# api-gateway-00002-xyz       ACTIVE  2024-12-06 09:00:00  <- Previous
# api-gateway-00001-def       ACTIVE  2024-12-05 15:00:00

# Rollback to previous revision
gcloud run services update-traffic api-gateway \
  --region=us-central1 \
  --to-revisions=api-gateway-00002-xyz=100
```

### Rollback All Services

Create a script to rollback all services at once:

```bash
#!/bin/bash
# rollback-all.sh

REGION=us-central1
SERVICES=("api-gateway" "websocket-server" "face-processing-service")

for service in "${SERVICES[@]}"; do
  echo "Rolling back $service..."

  # Get previous revision (second in list)
  PREV_REVISION=$(gcloud run revisions list \
    --service=$service \
    --region=$REGION \
    --format="value(name)" \
    --limit=2 | tail -n 1)

  if [ -z "$PREV_REVISION" ]; then
    echo "❌ No previous revision found for $service"
    continue
  fi

  # Rollback
  gcloud run services update-traffic $service \
    --region=$REGION \
    --to-revisions=$PREV_REVISION=100

  echo "✅ Rolled back $service to $PREV_REVISION"
done

echo ""
echo "=== Rollback Complete ==="
echo "Verify services are working correctly."
```

Make it executable and run:

```bash
chmod +x rollback-all.sh
./rollback-all.sh
```

### Gradual Rollback (Canary)

For less critical issues, gradually shift traffic back:

```bash
# Shift 50% traffic to previous revision
gcloud run services update-traffic api-gateway \
  --region=us-central1 \
  --to-revisions=api-gateway-00003-abc=50,api-gateway-00002-xyz=50

# Monitor error rates and latency
# If stable, shift 100% to previous revision
gcloud run services update-traffic api-gateway \
  --region=us-central1 \
  --to-revisions=api-gateway-00002-xyz=100
```

### Rollback to Specific Revision

```bash
# List all revisions
gcloud run revisions list \
  --service=api-gateway \
  --region=us-central1

# Rollback to specific revision (e.g., from 2 days ago)
gcloud run services update-traffic api-gateway \
  --region=us-central1 \
  --to-revisions=api-gateway-00001-def=100
```

### Verify Rollback

```bash
# Check current revision
gcloud run services describe api-gateway \
  --region=us-central1 \
  --format="value(status.traffic[0].revisionName)"

# Test service health
curl https://api-gateway-abc123-uc.a.run.app/health

# Check logs for errors
gcloud run services logs read api-gateway \
  --region=us-central1 \
  --limit=50
```

## Database Rollback

### Migration Rollback

#### Using Prisma

```bash
# Check migration history
pnpm db:studio
# Navigate to _prisma_migrations table

# Or via psql
psql "host=127.0.0.1 port=5432 dbname=digitwinlive-db user=postgres" \
  -c "SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 10;"

# Mark migration as rolled back (if reversible)
pnpm db:migrate:resolve --rolled-back 20241206_add_new_column

# Apply previous migration state
# Note: Prisma doesn't support automatic rollback
# You need to create a new migration that reverses changes
```

#### Manual Rollback

```sql
-- Connect to database
psql "host=127.0.0.1 port=5432 dbname=digitwinlive-db user=postgres"

-- Example: Rollback column addition
ALTER TABLE users DROP COLUMN IF EXISTS new_column;

-- Example: Rollback table creation
DROP TABLE IF EXISTS new_table;

-- Example: Rollback index creation
DROP INDEX IF EXISTS idx_users_email;

-- Verify changes
\d users
```

### Backup Restoration

#### List Available Backups

```bash
# List all backups
gcloud sql backups list \
  --instance=digitwinlive-db \
  --format="table(id,windowStartTime,status)"

# Example output:
# ID                  WINDOW_START_TIME           STATUS
# 1701849600000000    2024-12-06T03:00:00.000Z   SUCCESSFUL
# 1701763200000000    2024-12-05T03:00:00.000Z   SUCCESSFUL
# 1701676800000000    2024-12-04T03:00:00.000Z   SUCCESSFUL
```

#### Restore from Backup

**Option 1: Restore to Same Instance (Overwrites Data)**

```bash
# ⚠️ WARNING: This will overwrite current data!
# Create a backup first
gcloud sql backups create \
  --instance=digitwinlive-db \
  --description="Pre-rollback backup"

# Restore from backup
gcloud sql backups restore 1701849600000000 \
  --backup-instance=digitwinlive-db \
  --quiet

# This takes 5-30 minutes depending on database size
```

**Option 2: Restore to New Instance (Safer)**

```bash
# Create new instance from backup
gcloud sql instances create digitwinlive-db-restored \
  --backup=1701849600000000 \
  --backup-instance=digitwinlive-db \
  --region=us-central1

# Test the restored instance
# If good, update services to use new instance
# If bad, delete and try different backup
```

#### Point-in-Time Recovery

```bash
# Restore to specific timestamp (within backup retention period)
gcloud sql instances restore-backup digitwinlive-db \
  --backup-id=1701849600000000 \
  --backup-instance=digitwinlive-db

# Or create new instance at specific point in time
gcloud sql instances create digitwinlive-db-pitr \
  --source-instance=digitwinlive-db \
  --point-in-time=2024-12-06T09:30:00Z \
  --region=us-central1
```

### Data-Only Rollback

If only specific data needs to be restored:

```bash
# Export data from backup
gcloud sql export sql digitwinlive-db \
  gs://clone-backups-prod/rollback-export.sql \
  --database=digitwinlive-db

# Download and extract specific tables
gsutil cp gs://clone-backups-prod/rollback-export.sql .

# Import specific tables
psql "host=127.0.0.1 port=5432 dbname=digitwinlive-db user=postgres" \
  < rollback-export.sql
```

## Configuration Rollback

### Environment Variables

```bash
# Get current configuration
gcloud run services describe api-gateway \
  --region=us-central1 \
  --format="value(spec.template.spec.containers[0].env)" \
  > current-env.txt

# Restore previous configuration
# (Keep previous configs in version control)
gcloud run services update api-gateway \
  --region=us-central1 \
  --set-env-vars="$(cat previous-env.txt)"
```

### Secrets

```bash
# List secret versions
gcloud secrets versions list jwt-secret

# Rollback to previous version
gcloud secrets versions enable 2 --secret=jwt-secret
gcloud secrets versions disable 3 --secret=jwt-secret

# Update service to use previous version
gcloud run services update api-gateway \
  --region=us-central1 \
  --update-secrets=JWT_SECRET=jwt-secret:2
```

### Infrastructure (Terraform)

```bash
# Rollback Terraform changes
cd infrastructure/terraform

# View previous state
terraform show

# Rollback to previous commit
git log --oneline
git checkout <previous-commit>

# Apply previous configuration
terraform plan
terraform apply
```

## Emergency Procedures

### Critical Production Issue

**Immediate Actions (< 5 minutes)**:

```bash
# 1. Rollback all Cloud Run services
./rollback-all.sh

# 2. Verify services are responding
for service in api-gateway websocket-server face-processing-service; do
  echo "Testing $service..."
  curl -f https://$service-url.run.app/health || echo "❌ $service failed"
done

# 3. Check error rates in logs
gcloud run services logs read api-gateway \
  --region=us-central1 \
  --log-filter="severity>=ERROR" \
  --limit=50
```

**Follow-up Actions (< 30 minutes)**:

```bash
# 4. Notify team
# Send alert via Slack/Discord/Email

# 5. Create incident report
cat > incident-$(date +%Y%m%d-%H%M%S).md << EOF
# Incident Report

**Date**: $(date)
**Severity**: Critical
**Status**: Rolled back

## Timeline
- $(date): Issue detected
- $(date): Rollback initiated
- $(date): Services restored

## Impact
- Services affected: [list]
- Duration: [duration]
- Users affected: [estimate]

## Root Cause
[To be determined]

## Actions Taken
1. Rolled back Cloud Run services
2. Verified service health
3. Monitored error rates

## Next Steps
1. Investigate root cause
2. Fix issues in development
3. Test thoroughly before redeployment
EOF

# 6. Monitor for 1 hour
watch -n 60 'gcloud run services logs read api-gateway --region=us-central1 --log-filter="severity>=ERROR" --limit=10'
```

### Database Corruption

```bash
# 1. Stop all services immediately
for service in api-gateway websocket-server face-processing-service; do
  gcloud run services update $service \
    --region=us-central1 \
    --max-instances=0
done

# 2. Create emergency backup
gcloud sql backups create \
  --instance=digitwinlive-db \
  --description="Emergency backup before restoration"

# 3. Restore from last known good backup
gcloud sql backups restore <backup-id> \
  --backup-instance=digitwinlive-db

# 4. Verify data integrity
psql "host=127.0.0.1 port=5432 dbname=digitwinlive-db user=postgres" << EOF
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM conversations;
SELECT COUNT(*) FROM knowledge_documents;
EOF

# 5. Restart services
for service in api-gateway websocket-server face-processing-service; do
  gcloud run services update $service \
    --region=us-central1 \
    --max-instances=10
done
```

### Complete System Failure

```bash
# 1. Check GCP status
curl https://status.cloud.google.com/incidents.json

# 2. Verify all resources
./scripts/gcp-manage.sh status

# 3. Restart Cloud SQL if stopped
gcloud sql instances patch digitwinlive-db \
  --activation-policy=ALWAYS

# 4. Redeploy all services from last known good version
git checkout <last-good-commit>
./scripts/gcp-deploy.sh deploy --env=production

# 5. Monitor recovery
watch -n 30 './scripts/gcp-manage.sh status'
```

## Post-Rollback Verification

### Verification Checklist

```bash
# 1. Service Health
curl https://api-gateway-url.run.app/health
curl https://websocket-server-url.run.app/health
curl https://face-processing-url.run.app/health

# 2. Database Connectivity
psql "host=127.0.0.1 port=5432 dbname=digitwinlive-db user=postgres" -c "SELECT 1;"

# 3. Critical Endpoints
curl -X POST https://api-gateway-url.run.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'

# 4. Error Rates
gcloud run services logs read api-gateway \
  --region=us-central1 \
  --log-filter="severity>=ERROR" \
  --limit=100

# 5. Performance Metrics
gcloud monitoring time-series list \
  --filter='metric.type="run.googleapis.com/request_latencies"' \
  --interval-start-time=$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ) \
  --interval-end-time=$(date -u +%Y-%m-%dT%H:%M:%SZ)
```

### Monitoring After Rollback

```bash
# Monitor for 1 hour after rollback
# Check every 5 minutes

# Error rate
gcloud run services logs read api-gateway \
  --region=us-central1 \
  --log-filter="severity>=ERROR" \
  --limit=10

# Request count
gcloud monitoring time-series list \
  --filter='metric.type="run.googleapis.com/request_count"'

# Latency
gcloud monitoring time-series list \
  --filter='metric.type="run.googleapis.com/request_latencies"'

# Database connections
psql "host=127.0.0.1 port=5432 dbname=digitwinlive-db user=postgres" \
  -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';"
```

### Success Criteria

Rollback is successful when:

- ✅ All services return 200 OK on health checks
- ✅ Error rate < 1% for 30 minutes
- ✅ P95 latency < 1 second
- ✅ Database connections stable
- ✅ No critical errors in logs
- ✅ User-facing features working

## Prevention

### Pre-Deployment Checklist

Before deploying to production:

- [ ] All tests passing
- [ ] Code reviewed and approved
- [ ] Database migrations tested
- [ ] Rollback plan documented
- [ ] Monitoring alerts configured
- [ ] Backup verified recent
- [ ] Staging deployment successful
- [ ] Performance tested
- [ ] Security scan passed

### Deployment Best Practices

1. **Deploy during low-traffic hours**: Minimize user impact
2. **Use gradual rollout**: Deploy to 10% → 50% → 100%
3. **Monitor actively**: Watch logs and metrics during deployment
4. **Have rollback ready**: Keep rollback script accessible
5. **Test in staging first**: Always deploy to staging before production
6. **Document changes**: Keep changelog updated
7. **Communicate**: Notify team of deployment

### Backup Strategy

```bash
# Automated daily backups (configured in Cloud SQL)
gcloud sql instances patch digitwinlive-db \
  --backup-start-time=03:00 \
  --retained-backups-count=30

# Manual backup before major changes
gcloud sql backups create \
  --instance=digitwinlive-db \
  --description="Pre-deployment backup $(date +%Y-%m-%d)"

# Verify backups weekly
gcloud sql backups list --instance=digitwinlive-db
```

## Additional Resources

- [GCP Deployment Guide](./GCP-DEPLOYMENT-GUIDE.md)
- [GCP Troubleshooting](./GCP-TROUBLESHOOTING.md)
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Cloud SQL Backup Documentation](https://cloud.google.com/sql/docs/postgres/backup-recovery)
- [Incident Response Guide](https://cloud.google.com/architecture/framework/reliability/incident-response)
