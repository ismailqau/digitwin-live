# Monitoring Module Outputs

# Note: Dashboard removed - use GCP Console built-in dashboards instead

output "email_notification_channel_id" {
  description = "Email notification channel ID"
  value       = google_monitoring_notification_channel.email.id
}

output "discord_notification_channel_id" {
  description = "Discord notification channel ID (if configured)"
  value       = var.discord_webhook_url != "" ? google_monitoring_notification_channel.discord[0].id : null
}

output "notification_channel_ids" {
  description = "All notification channel IDs"
  value       = local.notification_channels
}

output "alert_policy_ids" {
  description = "Alert policy IDs"
  value = {
    high_error_rate   = google_monitoring_alert_policy.high_error_rate.id
    high_latency      = google_monitoring_alert_policy.high_latency.id
    database_failures = google_monitoring_alert_policy.database_failures.id
  }
}
