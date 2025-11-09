# 🗑️ Cloud SQL Cleanup Guide

## Your Current Situation

You have **3 Cloud SQL instances** running:

| Instance | Version | Tier | IP | Cost/Month |
|----------|---------|------|----|-----------:|
| digitwin-live-db | POSTGRES_15 | db-f1-micro | 34.59.156.169 | ~$7.67 |
| digitwinlive-db | POSTGRES_17 | (standard) | 136.114.179.89 | ~$50 |
| clone-db-prod | POSTGRES_17 | db-perf-optimized-N-4 | 34.66.124.92 | ~$150 |

**Total cost: ~$207/month**

---

## 🎯 Quick Cleanup Options

### Option 1: Use the SQL-Only Cleanup Script (Recommended)
```bash
pnpm gcp:cleanup-sql
```

This will:
1. Show all your Cloud SQL instances with details
2. Let you select which ones to delete (e.g., 1,3)
3. Confirm before deletion
4. Delete only the selected instances

**Example interaction**:
```
=== Cloud SQL Instance Cleanup ===

Found 3 Cloud SQL instances:

NAME              DATABASE_VERSION  REGION       TIER                   IP_ADDRESS      STATUS
clone-db-prod     POSTGRES_17       us-central1  db-perf-optimized-N-4  34.66.124.92    RUNNABLE
digitwinlive-db   POSTGRES_17       us-central1  db-n1-standard-1       136.114.179.89  RUNNABLE
digitwin-live-db  POSTGRES_15       us-central1  db-f1-micro            34.59.156.169   RUNNABLE

Select instances to delete:

  1) clone-db-prod
  2) digitwinlive-db
  3) digitwin-live-db
  4) All instances
  5) Cancel

Enter choices (comma-separated, e.g., 1,3): 1,3

You selected to delete:
  ✓ clone-db-prod
  ✓ digitwin-live-db

Confirm deletion? (yes/NO) yes

Deleting Cloud SQL instance: clone-db-prod...
✅ Cloud SQL instance clone-db-prod deleted

Deleting Cloud SQL instance: digitwin-live-db...
✅ Cloud SQL instance digitwin-live-db deleted

✅ Cleanup complete!
```

### Option 2: Use Main Cleanup Script
```bash
pnpm gcp:cleanup-menu
# Select: 3 (Cloud SQL instances)
```

This integrates with the full cleanup menu and will also show instance selection.

### Option 3: Direct gcloud Commands
```bash
# Delete specific instances
gcloud sql instances delete digitwin-live-db --quiet
gcloud sql instances delete clone-db-prod --quiet

# Keep the one you're using
# (check .env to see which DATABASE_URL you're using)
```

---

## 💡 Recommendations

### Which Instances to Keep?

1. **Check your .env file**:
```bash
grep DATABASE_URL .env
```

2. **Recommended setup**:
   - **Keep**: `digitwinlive-db` (POSTGRES_17, standard tier) - ~$50/month
   - **Delete**: `digitwin-live-db` (old POSTGRES_15) - save $7.67/month
   - **Delete**: `clone-db-prod` (expensive tier) - save $150/month

3. **Total savings**: ~$157/month

### Migration Path

If you want to keep the most cost-effective setup:

```bash
# 1. Backup current data (if needed)
gcloud sql export sql digitwinlive-db gs://your-backup-bucket/backup.sql \
  --database=digitwin_live

# 2. Delete old/expensive instances
pnpm gcp:cleanup-sql
# Select: 1,3 (clone-db-prod and digitwin-live-db)

# 3. Update .env to use the remaining instance
# DATABASE_URL should point to digitwinlive-db
```

---

## 🚨 Important Notes

### Before Deleting

1. **Check which instance is in use**:
```bash
grep DATABASE_URL .env
```

2. **Backup important data**:
```bash
# Export database
gcloud sql export sql INSTANCE_NAME gs://bucket/backup.sql \
  --database=DATABASE_NAME
```

3. **Verify connections**:
```bash
# Check if any services are connected
gcloud sql operations list --instance=INSTANCE_NAME --limit=5
```

### After Deleting

1. **Update .env file** if you deleted the active instance
2. **Update connection strings** in your application
3. **Verify application still works**:
```bash
pnpm verify:vector-db
```

---

## 📊 Cost Comparison

### Current State (3 instances)
- digitwin-live-db (POSTGRES_15): $7.67/month
- digitwinlive-db (POSTGRES_17): $50/month
- clone-db-prod (POSTGRES_17): $150/month
- **Total**: $207.67/month

### Recommended State (1 instance)
- digitwinlive-db (POSTGRES_17): $50/month
- **Total**: $50/month
- **Savings**: $157.67/month ($1,892/year)

### Alternative: Stop Instead of Delete

If you're not sure, you can stop instances instead:
```bash
# Stop an instance (keeps data, stops billing)
gcloud sql instances patch INSTANCE_NAME --activation-policy=NEVER

# Start it again later
gcloud sql instances patch INSTANCE_NAME --activation-policy=ALWAYS
```

---

## 🔧 Troubleshooting

### "Cannot delete instance with backups"
```bash
# Delete backups first
gcloud sql backups list --instance=INSTANCE_NAME
gcloud sql backups delete BACKUP_ID --instance=INSTANCE_NAME
```

### "Instance is in use"
```bash
# Check connections
gcloud sql operations list --instance=INSTANCE_NAME

# Force delete (use with caution)
gcloud sql instances delete INSTANCE_NAME --quiet --force
```

### "Permission denied"
```bash
# Ensure you have the right permissions
gcloud projects get-iam-policy PROJECT_ID

# You need: roles/cloudsql.admin
```

---

## 📝 Quick Commands

```bash
# List all instances
gcloud sql instances list

# Show instance details
gcloud sql instances describe INSTANCE_NAME

# Delete specific instance
gcloud sql instances delete INSTANCE_NAME --quiet

# Interactive cleanup (recommended)
pnpm gcp:cleanup-sql

# Check costs
pnpm gcp:cost
```

---

## ✅ Recommended Action Plan

For your situation, I recommend:

```bash
# Step 1: Check which instance you're using
grep DATABASE_URL .env

# Step 2: Run the cleanup script
pnpm gcp:cleanup-sql

# Step 3: Select instances to delete
# Enter: 1,3 (to delete clone-db-prod and digitwin-live-db)
# This keeps digitwinlive-db (POSTGRES_17, standard tier)

# Step 4: Verify everything works
pnpm verify:vector-db

# Result: Save $157/month while keeping the best instance
```

---

**Need help?** Check the main [GCP Management Guide](./GCP-MANAGEMENT.md) for more details.
