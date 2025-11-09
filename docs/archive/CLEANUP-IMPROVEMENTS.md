# 🎯 Cleanup Script Improvements - Instance Selection

## What's New

The cleanup script now supports **selective deletion of individual Cloud SQL instances and storage buckets**, not just all-or-nothing deletion.

---

## 🆕 New Features

### 1. Cloud SQL Instance Selection

When you choose to delete Cloud SQL instances, the script now:

1. **Lists all instances** with full details (version, tier, IP, status)
2. **Lets you select specific instances** to delete (e.g., 1,3)
3. **Shows what will be deleted** before confirmation
4. **Deletes only selected instances**

**Example**:

```bash
pnpm gcp:cleanup-menu
# Select: 3 (Cloud SQL instances)

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
```

### 2. Storage Bucket Selection

Similarly, when deleting storage buckets:

1. **Lists all buckets** with sizes
2. **Lets you select specific buckets** to delete
3. **Shows confirmation** before deletion
4. **Deletes only selected buckets**

**Example**:

```bash
Found 4 storage buckets:

  - digitwin-live-voice-models (0B)
  - digitwin-live-face-models (0B)
  - digitwin-live-documents (1.2GB)
  - digitwin-live-uploads (500MB)

Select buckets to delete:
  1) digitwin-live-voice-models
  2) digitwin-live-face-models
  3) digitwin-live-documents
  4) digitwin-live-uploads
  5) All buckets
  6) Cancel

Enter choices (comma-separated, e.g., 1,2): 3,4
```

### 3. Standalone SQL Cleanup Script

New dedicated script for Cloud SQL cleanup:

```bash
pnpm gcp:cleanup-sql
```

**Benefits**:

- Focus only on SQL instances
- Faster than full cleanup menu
- Perfect for managing multiple database instances
- Shows detailed instance information

---

## 💡 Use Cases

### Use Case 1: Remove Old Database Instances

You have multiple database instances from testing/migration:

```bash
pnpm gcp:cleanup-sql
# Select old instances: 1,3
# Keep the production instance: 2
```

**Result**: Clean up test instances, keep production running.

### Use Case 2: Delete Expensive Instances

You have an over-provisioned instance:

```bash
pnpm gcp:cleanup-sql
# Select the expensive db-perf-optimized instance
# Keep the standard tier instance
```

**Result**: Save $100+/month by removing expensive tier.

### Use Case 3: Clean Up After Migration

After migrating from POSTGRES_15 to POSTGRES_17:

```bash
pnpm gcp:cleanup-sql
# Select the old POSTGRES_15 instance
# Keep the new POSTGRES_17 instance
```

**Result**: Remove old version, keep new version.

### Use Case 4: Selective Bucket Cleanup

Remove only large/unused buckets:

```bash
pnpm gcp:cleanup-menu
# Select: 4 (Storage buckets)
# Choose only the large buckets to delete
```

**Result**: Free up storage, keep important buckets.

---

## 🔄 How It Works

### Before (Old Behavior)

```
Delete Cloud SQL? (y/N) y
→ Deletes ALL instances (no choice)
```

### After (New Behavior)

```
Delete Cloud SQL? (y/N) y
→ Shows list of all instances
→ Let you select which ones to delete
→ Confirms selection
→ Deletes only selected instances
```

---

## 📊 Comparison

| Feature                | Before              | After                               |
| ---------------------- | ------------------- | ----------------------------------- |
| SQL instance selection | ❌ All or nothing   | ✅ Select specific instances        |
| Bucket selection       | ❌ All or nothing   | ✅ Select specific buckets          |
| Instance details       | ❌ No details shown | ✅ Full details (version, tier, IP) |
| Bucket sizes           | ❌ No sizes shown   | ✅ Shows sizes                      |
| Flexibility            | Low                 | High                                |
| Safety                 | Medium              | High                                |

---

## 🎯 Real-World Example

### Your Current Situation

You have 3 Cloud SQL instances:

- `digitwin-live-db` (POSTGRES_15, $7.67/month) - OLD
- `digitwinlive-db` (POSTGRES_17, $50/month) - CURRENT
- `clone-db-prod` (POSTGRES_17, $150/month) - TEST/EXPENSIVE

### What You Want

Keep the current production instance, delete the old and expensive ones.

### How to Do It

```bash
# Option 1: Use dedicated SQL cleanup
pnpm gcp:cleanup-sql
# Enter: 1,3 (delete clone-db-prod and digitwin-live-db)

# Option 2: Use main cleanup menu
pnpm gcp:cleanup-menu
# Select: 3 (Cloud SQL)
# Enter: 1,3 (delete clone-db-prod and digitwin-live-db)
```

### Result

- ✅ Keep: `digitwinlive-db` (POSTGRES_17, $50/month)
- ❌ Delete: `digitwin-live-db` (save $7.67/month)
- ❌ Delete: `clone-db-prod` (save $150/month)
- **Total savings**: $157.67/month ($1,892/year)

---

## 🚀 Commands

### New Commands

```bash
# Dedicated SQL cleanup
pnpm gcp:cleanup-sql

# Main cleanup with instance selection
pnpm gcp:cleanup-menu
# Then select: 3 (Cloud SQL)

# Main cleanup with bucket selection
pnpm gcp:cleanup-menu
# Then select: 4 (Storage buckets)
```

### Existing Commands (Still Work)

```bash
pnpm gcp:cleanup              # Interactive menu
pnpm gcp:cleanup-selective    # Y/N for each resource type
pnpm gcp:cleanup-all          # Delete everything
```

---

## 📝 Technical Details

### Implementation

The improved functions:

1. **`delete_cloud_sql()`**:
   - Lists all SQL instances using `gcloud sql instances list`
   - Displays in table format with full details
   - Creates array of instances for selection
   - Parses comma-separated choices
   - Deletes only selected instances

2. **`delete_buckets()`**:
   - Lists all buckets using `gsutil ls`
   - Shows bucket sizes using `gsutil du`
   - Creates array of buckets for selection
   - Parses comma-separated choices
   - Deletes only selected buckets

### Error Handling

- ✅ Handles invalid choices gracefully
- ✅ Continues if some deletions fail
- ✅ Shows clear error messages
- ✅ Allows cancellation at any point

---

## 🎉 Benefits

### For You

- ✅ **Precise control** - Delete exactly what you want
- ✅ **Cost optimization** - Remove expensive instances easily
- ✅ **Safety** - See what you're deleting before confirmation
- ✅ **Flexibility** - Multiple ways to accomplish the same task

### For Your Wallet

- 💰 **Save $157/month** by removing unnecessary instances
- 💰 **Avoid mistakes** by seeing details before deletion
- 💰 **Quick cleanup** of test/development resources

### For Your Workflow

- ⚡ **Faster** - Dedicated scripts for specific tasks
- ⚡ **Clearer** - See all options at once
- ⚡ **Safer** - Multiple confirmation steps

---

## 📚 Documentation

- **[Cleanup SQL Guide](./CLEANUP-SQL-GUIDE.md)** - Detailed guide for your specific situation
- **[GCP Quick Reference](./GCP-QUICK-REFERENCE.md)** - All commands
- **[GCP Management Guide](./GCP-MANAGEMENT.md)** - Complete management guide

---

## ✅ Next Steps

1. **Check your current instances**:

```bash
gcloud sql instances list
```

2. **Run the cleanup**:

```bash
pnpm gcp:cleanup-sql
```

3. **Select instances to delete** (e.g., 1,3)

4. **Verify everything works**:

```bash
pnpm verify:vector-db
```

5. **Check your savings**:

```bash
pnpm gcp:cost
```

---

**Status**: ✅ Complete and Ready to Use  
**Version**: 2.1  
**Date**: November 9, 2025
