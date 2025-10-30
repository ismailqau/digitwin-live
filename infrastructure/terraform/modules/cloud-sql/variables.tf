# Cloud SQL Module Variables

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
}

variable "network_id" {
  description = "VPC network ID"
  type        = string
}

variable "database_tier" {
  description = "Database instance tier"
  type        = string
}

variable "database_version" {
  description = "PostgreSQL version"
  type        = string
}

variable "backup_enabled" {
  description = "Enable automated backups"
  type        = bool
}

variable "backup_start_time" {
  description = "Backup start time"
  type        = string
}

variable "high_availability" {
  description = "Enable high availability"
  type        = bool
}

variable "disk_size" {
  description = "Disk size in GB"
  type        = number
  default     = 100
}

variable "database_password" {
  description = "Database password"
  type        = string
  sensitive   = true
  default     = "" # Should be provided via environment variable or secret manager
}
