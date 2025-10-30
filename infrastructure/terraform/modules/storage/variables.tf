# Cloud Storage Module Variables

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "location" {
  description = "Storage bucket location"
  type        = string
}

variable "lifecycle_age" {
  description = "Days before objects are deleted"
  type        = number
}

variable "kms_key_name" {
  description = "KMS key name for encryption"
  type        = string
  default     = null
}
