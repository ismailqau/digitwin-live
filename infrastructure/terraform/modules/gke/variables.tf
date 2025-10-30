# GKE Module Variables

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
}

variable "project_id" {
  description = "GCP Project ID"
  type        = string
  default     = ""
}

variable "network_id" {
  description = "VPC network ID"
  type        = string
}

variable "subnetwork_id" {
  description = "Subnet ID"
  type        = string
}

variable "enable_autopilot" {
  description = "Enable GKE Autopilot mode"
  type        = bool
}

variable "gpu_node_pools" {
  description = "GPU node pool configurations"
  type = list(object({
    name         = string
    machine_type = string
    gpu_type     = string
    gpu_count    = number
    min_nodes    = number
    max_nodes    = number
  }))
}
