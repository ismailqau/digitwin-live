# Load Balancer Module Variables

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
}

variable "domains" {
  description = "List of domains for SSL certificate"
  type        = list(string)
  default     = []
}

variable "cloud_run_service_name" {
  description = "Cloud Run service name for backend"
  type        = string
  default     = ""
}
