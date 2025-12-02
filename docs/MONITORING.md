# Monitoring & Alerting - Complete Guide

## Overview

Minimal essential monitoring with 3 critical alerts. Uses GCP Console dashboards (no custom setup). **Cost: $0/month**.

## Quick Start

```bash
# Test setup
pnpm test:monitoring

# Deploy
cd infrastructure/terraform
terraform apply -target=module.monitoring
```

## What's Monitored

### 3 Essential Alerts

1. **High Error Rate** - 5xx errors > 5% (5 min window)
2. **High Latency** - P95 > 3 seconds (5 min window)
3. **Database Failures** - Connections < 1 (1 min window)

### Notifications

Alerts sent to:

- 📧 Email (detailed)
- 💬 Discord (optional, quick notifications)

## Configuration

### 1. Create terraform.tfvars

```bash
cd infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars
```

### 2. Update Values

Edit `terraform.tfvars`:

```hcl
project_id  = "digitwinlive"
environment = "dev"

# Your email
alert_email = "your-email@example.com"

# Discord webhook (optional)
discord_webhook_url = "https://discord.com/api/webhooks/ID/TOKEN"
```

### 3. Get Discord Webhook (Optional)

1. Discord → Server Settings → Integrations → Webhooks
2. New Webhook → Name: "GCP Alerts" → Copy URL

### 4. Deploy

```bash
terraform plan -target=module.monitoring
terraform apply -target=module.monitoring
```

## Verify

```bash
# Check channels
gcloud alpha monitoring channels list

# Check policies
gcloud alpha monitoring policies list

# View in console
https://console.cloud.google.com/monitoring/alerting/policies
```

## Update Configuration

### Change Email

```hcl
# terraform.tfvars
alert_email = "new-email@example.com"
```

```bash
terraform apply -target=module.monitoring
```

### Add/Remove Discord

```hcl
# Add Discord
discord_webhook_url = "https://discord.com/api/webhooks/ID/TOKEN"

# Remove Discord
discord_webhook_url = ""
```

```bash
terraform apply -target=module.monitoring
```

## Dashboards

Use GCP Console built-in dashboards (free, no setup):

- **Monitoring**: https://console.cloud.google.com/monitoring
- **Cloud Run**: https://console.cloud.google.com/run
- **Cloud SQL**: https://console.cloud.google.com/sql

## Commands

```bash
# Test monitoring
pnpm test:monitoring

# Check status
pnpm gcp:status

# View costs
pnpm gcp:cost
```

## Cost

**Total: $0/month**

- Alert policies (3): Free (first 100)
- Notification channels: Free
- Metrics: Included with GCP services
- Dashboards: Free (GCP Console)

## Troubleshooting

### Discord Not Working

```bash
# Test webhook
curl -X POST "YOUR_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"content": "Test"}'

# Check channel exists
gcloud alpha monitoring channels list | grep Discord
```

### Email Not Working

- Check spam folder
- Verify email in: `gcloud alpha monitoring channels describe CHANNEL_ID`
- Test from GCP Console → Monitoring → Alerting → Test Notification

### Terraform Errors

```bash
# Reinitialize
terraform init -reconfigure

# Check state
terraform state list | grep monitoring

# Destroy and recreate
terraform destroy -target=module.monitoring
terraform apply -target=module.monitoring
```

## What's NOT Included (Intentionally)

- ❌ Custom dashboards (use GCP Console)
- ❌ CPU/Memory alerts (Cloud Run auto-scales)
- ❌ Custom metrics (add when needed)
- ❌ Distributed tracing (add at scale)
- ❌ Log-based alerts (keep it simple)

## Related Docs

- [Backend Setup](../infrastructure/terraform/BACKEND-SETUP.md)
- [GCP Management](./GCP-MANAGEMENT.md)

## Summary

✅ **Minimal monitoring with zero cost**

- 3 essential alerts
- Email + Discord notifications
- GCP Console dashboards
- No maintenance required
