# Monitoring Module Outputs

output "dashboard_id" {
  description = "Monitoring dashboard ID"
  value       = google_monitoring_dashboard.main.id
}

output "notification_channel_id" {
  description = "Notification channel ID"
  value       = google_monitoring_notification_channel.email.id
}
