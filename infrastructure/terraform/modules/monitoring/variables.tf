# Monitoring Module Variables

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

variable "project_id" {
  description = "GCP Project ID"
  type        = string
  default     = "digitwinlive"
}

variable "alert_email" {
  description = "Email address for alerts"
  type        = string
  default     = "ismail@aimnovo.com"
}

variable "discord_webhook_url" {
  description = "Discord webhook URL for alerts (optional)"
  type        = string
  default     = "https://discord.com/api/webhooks/1445357864536506452/c0Fe_8RAHGAbVRhsoXZQcWM3pE4j5-aSB2WV36-bdhMUIZAC6UyQxWSrsOwS-iPJkOis"
}
