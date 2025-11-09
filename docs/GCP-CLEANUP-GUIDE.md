# 🗑️ GCP Cleanup Guide

Complete guide for cleaning up GCP resources with selective deletion capabilities.

---

## 🎯 Quick Start

### Delete Specific Cloud SQL Instances

```bash
# Fastest way - dedicated SQL cleanup
pnpm gcp:cleanup-sql

# Or use the main menu
pnpm gcp:cleanup-menu
# Then select: 3 (Cloud SQL instances)
```

### Stop All Resources (Save Costs)

```bash
# Stop everything when not in use
pnpm gcp:stop-all

# Start everything back up
pnpm gcp:start-all
```

---

## 📋 All Cleanup Options

### 1. Interactive Menu (Recommended)
```bash
pnpm gcp:cleanup
```
Shows main menu with all cleanup options.

### 2. Menu-Based Selection
```bash
pnpm gcp:cleanup-menu
```
Select specific resources from numbered list (e.g., 1,3,4).

### 3. Interactive Y/N
```bash
pnpm gcp:cleanup-selective
```
Answer y/n for each resource type.

### 4. Delete Everything
```bash
pnpm gcp:cleanup-all
```
Complete cleanup with confirmation.

### 5. SQL Only
```bash
pnpm gcp:cleanup-sql
```
Focus only on Cloud SQL instances.

---

## 🚀 Step-by-Step Example

### Scenario: Delete Specific SQL Instances

You have multiple Cloud SQL instances and want to delete only the old/expensive ones.

**Steps** (only 3 steps!):

1. **Run cleanup**:
```bash
pnpm gcp:cleanup-menu
```

2. **Select Cloud SQL**:
```
Available resources:
  1) Weaviate deployment
  2) GKE cluster
  3) Cloud SQL instances  ← Select this
  4) Storage buckets
  5) Service accounts
  6) Secrets
  7) All of the above
  8) Cancel

Enter choices: 3
```

3. **Select instances**:
```
Found 3 Cloud SQL instance(s):

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

Enter choices: 1,3  ← Delete expensive and old instances
```

4. **Confirm**:
```
You selected to delete:
  ✓ clone-db-prod
  ✓ digitwin-live-db

Confirm deletion? (yes/NO) yes
```

**Result**: Deleted 2 instances, kept production instance, saved $157/month!

---

## 💡 Selection Syntax

### Single Selection
```
Enter choices: 1
```
Deletes only item #1.

### Multiple Selection
```
Enter choices: 1,3
```
Deletes items #1 and #3.

### Multiple with Spaces
```
Enter choices: 1, 3, 4
```
Deletes items #1, #3, and #4 (spaces are trimmed).

### All Items
```
Enter choices: 4
```
(When "4) All instances" is shown)

### Cancel
```
Enter choices: 5
```
Or just press Enter without typing anything.

---

## 🛡️ Safety Features

✅ **Multiple confirmations** - Confirm at each step  
✅ **Show full details** - See instance info before deletion  
✅ **Cancel anytime** - Press Enter or select Cancel  
✅ **Clear feedback** - Know exactly what's happening  
✅ **Error handling** - Continues even if some deletions fail  

---

## 💰 Cost Optimization

### Stop Instead of Delete

If you're not sure about deleting, stop resources instead:

```bash
# Stop all resources (saves ~$74/month)
pnpm gcp:stop-all

# Start them back up when needed
pnpm gcp:start-all
```

**What gets stopped**:
- Cloud SQL instance (~$50/month savings)
- GKE cluster (~$24/month savings)
- Weaviate deployment

**No data loss** - everything resumes where it left off.

### Cost Comparison

| Action | Monthly Cost | Savings |
|--------|--------------|---------|
| Keep all 3 SQL instances | $207 | $0 |
| Delete 2 instances | $50 | $157 |
| Stop all resources | $0 | $207 |

---

## 📝 Before You Delete

### 1. Check Which Instance You're Using

```bash
grep DATABASE_URL .env
```

### 2. Backup Important Data

```bash
# Export database
gcloud sql export sql INSTANCE_NAME gs://bucket/backup.sql \
  --database=DATABASE_NAME
```

### 3. Verify Connections

```bash
# Check if any services are connected
gcloud sql operations list --instance=INSTANCE_NAME --limit=5
```

---

## 🔧 Common Scenarios

### Scenario 1: Remove Old Test Instances
```bash
pnpm gcp:cleanup-sql
# Select: 1,3 (test instances)
# Keep: 2 (production)
```

### Scenario 2: Delete Expensive Instance
```bash
pnpm gcp:cleanup-sql
# Select: 1 (db-perf-optimized-N-4)
# Keep: 2,3 (standard tiers)
```

### Scenario 3: Clean Up After Migration
```bash
pnpm gcp:cleanup-sql
# Select: 3 (POSTGRES_15)
# Keep: 1,2 (POSTGRES_17)
```

### Scenario 4: Delete Everything
```bash
pnpm gcp:cleanup-all
```

---

## 🚨 Troubleshooting

### "No instances found"
```bash
# Check if you're in the right project
gcloud config get-value project

# List instances manually
gcloud sql instances list
```

### "Permission denied"
```bash
# Check your permissions
gcloud projects get-iam-policy PROJECT_ID

# You need: roles/cloudsql.admin
```

### "Instance is in use"
```bash
# Check connections
gcloud sql operations list --instance=INSTANCE_NAME

# Force delete (use with caution)
gcloud sql instances delete INSTANCE_NAME --force
```

### Script hangs
Press `Ctrl+C` to cancel and try again.

---

## ✅ After Cleanup

### 1. Verify Everything Works

```bash
pnpm verify:vector-db
```

### 2. Check Status

```bash
pnpm gcp:status
```

### 3. Verify Costs

```bash
pnpm gcp:cost
```

---

## 📚 Related Documentation

- [GCP Management Guide](./GCP-MANAGEMENT.md) - Complete GCP management
- [GCP Quick Reference](./GCP-QUICK-REFERENCE.md) - Command cheat sheet
- [Vector Database Guide](./VECTOR-DATABASE.md) - Database setup and migration

---

## 🎯 Quick Command Reference

```bash
# Cleanup
pnpm gcp:cleanup-sql       # Delete specific SQL instances
pnpm gcp:cleanup-menu      # Select specific resources
pnpm gcp:cleanup-all       # Delete everything

# Stop/Start
pnpm gcp:stop-all          # Stop all (save costs)
pnpm gcp:start-all         # Start all

# Status & Info
pnpm gcp:status            # Check what's running
pnpm gcp:cost              # Check costs
pnpm gcp:list              # List all resources

# Verification
pnpm verify:vector-db      # Full verification
```

---

**Ready to clean up?**
```bash
pnpm gcp:cleanup-sql
```
