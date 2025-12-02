# Monitoring Module - Minimal Essential Alerts Only
# Note: Keep monitoring minimal. Use GCP Console for detailed dashboards.

# Email notification channel
resource "google_monitoring_notification_channel" "email" {
  display_name = "${var.environment} Email Alerts"
  type         = "email"

  labels = {
    email_address = var.alert_email
  }
}

# Discord notification channel (optional)
resource "google_monitoring_notification_channel" "discord" {
  count        = var.discord_webhook_url != "" ? 1 : 0
  display_name = "${var.environment} Discord Alerts"
  type         = "webhook_tokenauth"

  labels = {
    url = var.discord_webhook_url
  }

  sensitive_labels {
    auth_token = ""
  }
}

# Local variable for notification channels (email + discord if configured)
locals {
  notification_channels = concat(
    [google_monitoring_notification_channel.email.id],
    var.discord_webhook_url != "" ? [google_monitoring_notification_channel.discord[0].id] : []
  )
}

# Alert policy for high error rate (CRITICAL)
resource "google_monitoring_alert_policy" "high_error_rate" {
  display_name = "${var.environment} High Error Rate"
  combiner     = "OR"

  conditions {
    display_name = "Error rate > 5%"

    condition_threshold {
      filter          = "resource.type=\"cloud_run_revision\" AND metric.type=\"run.googleapis.com/request_count\" AND metric.label.response_code_class=\"5xx\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0.05

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_RATE"
      }
    }
  }

  notification_channels = local.notification_channels

  alert_strategy {
    auto_close = "1800s"
  }
}

# Alert policy for high latency (CRITICAL)
resource "google_monitoring_alert_policy" "high_latency" {
  display_name = "${var.environment} High Latency"
  combiner     = "OR"

  conditions {
    display_name = "P95 latency > 3 seconds"

    condition_threshold {
      filter          = "resource.type=\"cloud_run_revision\" AND metric.type=\"run.googleapis.com/request_latencies\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 3000

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_DELTA"
        cross_series_reducer = "REDUCE_PERCENTILE_95"
      }
    }
  }

  notification_channels = local.notification_channels

  alert_strategy {
    auto_close = "1800s"
  }
}

# Alert policy for database connection failures (CRITICAL)
resource "google_monitoring_alert_policy" "database_failures" {
  display_name = "${var.environment} Database Connection Failures"
  combiner     = "OR"

  conditions {
    display_name = "Database connection failures detected"

    condition_threshold {
      filter          = "resource.type=\"cloudsql_database\" AND metric.type=\"cloudsql.googleapis.com/database/network/connections\""
      duration        = "60s"
      comparison      = "COMPARISON_LT"
      threshold_value = 1

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }

  notification_channels = local.notification_channels

  alert_strategy {
    auto_close = "1800s"
  }
}

# Note: CPU/Memory alerts removed - Cloud Run auto-scales, use GCP Console for monitoring
# Note: Dashboard removed - Use GCP Console's built-in dashboards instead
