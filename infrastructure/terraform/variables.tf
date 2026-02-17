# Variables for Terraform configuration

variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "region" {
  description = "GCP region for resources"
  type        = string
  default     = "us-central1"
}

variable "subnet_cidr" {
  description = "CIDR range for the main subnet"
  type        = string
  default     = "10.0.0.0/24"
}

variable "vpc_connector_cidr" {
  description = "CIDR range for VPC Access Connector"
  type        = string
  default     = "10.8.0.0/28"
}

# Cloud SQL Variables
variable "database_tier" {
  description = "Cloud SQL instance tier"
  type        = string
  default     = "db-custom-4-16384"
}

variable "database_version" {
  description = "PostgreSQL version"
  type        = string
  default     = "POSTGRES_15"
}

variable "backup_enabled" {
  description = "Enable automated backups"
  type        = bool
  default     = true
}

variable "backup_start_time" {
  description = "Backup start time (HH:MM format)"
  type        = string
  default     = "03:00"
}

variable "high_availability" {
  description = "Enable high availability for Cloud SQL"
  type        = bool
  default     = false
}

# Cloud Storage Variables
variable "storage_location" {
  description = "Location for Cloud Storage buckets"
  type        = string
  default     = "US"
}

variable "storage_lifecycle_age" {
  description = "Days before objects are deleted"
  type        = number
  default     = 90
}

# Cloud Run Variables
variable "cloud_run_min_instances" {
  description = "Minimum number of Cloud Run instances"
  type        = number
  default     = 1
}

variable "cloud_run_max_instances" {
  description = "Maximum number of Cloud Run instances"
  type        = number
  default     = 100
}

variable "cloud_run_concurrency" {
  description = "Maximum concurrent requests per instance"
  type        = number
  default     = 50
}

variable "cloud_run_cpu" {
  description = "CPU allocation for Cloud Run"
  type        = string
  default     = "2000m"
}

variable "cloud_run_memory" {
  description = "Memory allocation for Cloud Run"
  type        = string
  default     = "2Gi"
}

# GKE Variables
variable "gke_enable_autopilot" {
  description = "Enable GKE Autopilot mode"
  type        = bool
  default     = true
}

variable "gke_gpu_node_pools" {
  description = "GPU node pool configurations"
  type = list(object({
    name         = string
    machine_type = string
    gpu_type     = string
    gpu_count    = number
    min_nodes    = number
    max_nodes    = number
  }))
  default = [
    {
      name         = "tts-gpu-pool"
      machine_type = "n1-standard-4"
      gpu_type     = "nvidia-tesla-t4"
      gpu_count    = 1
      min_nodes    = 1
      max_nodes    = 20
    },
    {
      name         = "lipsync-gpu-pool"
      machine_type = "n1-standard-4"
      gpu_type     = "nvidia-tesla-t4"
      gpu_count    = 1
      min_nodes    = 1
      max_nodes    = 15
    }
  ]
}

# Monitoring Variables
variable "alert_email" {
  description = "Email address for monitoring alerts"
  type        = string
  default     = "alerts@example.com"
}

variable "discord_webhook_url" {
  description = "Discord webhook URL for monitoring alerts (optional)"
  type        = string
  default     = ""
  sensitive   = true
}

# Qwen3-TTS Variables
variable "qwen3_tts_image" {
  description = "Container image URL for the Qwen3-TTS service"
  type        = string
  default     = "us-central1-docker.pkg.dev/digitwinlive/digitwinlive/qwen3-tts-service:latest"
}
