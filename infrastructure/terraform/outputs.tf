# Outputs for Terraform configuration

output "project_id" {
  description = "GCP Project ID"
  value       = var.project_id
}

output "region" {
  description = "GCP Region"
  value       = var.region
}

output "vpc_network_id" {
  description = "VPC Network ID"
  value       = google_compute_network.main.id
}

output "vpc_network_name" {
  description = "VPC Network Name"
  value       = google_compute_network.main.name
}

output "subnet_id" {
  description = "Subnet ID"
  value       = google_compute_subnetwork.main.id
}

output "database_connection_name" {
  description = "Cloud SQL connection name"
  value       = module.cloud_sql.connection_name
}

output "database_private_ip" {
  description = "Cloud SQL private IP address"
  value       = module.cloud_sql.private_ip_address
}

output "storage_buckets" {
  description = "Cloud Storage bucket names"
  value       = module.storage.bucket_names
}

output "cloud_run_urls" {
  description = "Cloud Run service URLs"
  value       = module.cloud_run.service_urls
}

output "gke_cluster_name" {
  description = "GKE cluster name"
  value       = module.gke.cluster_name
}

output "gke_cluster_endpoint" {
  description = "GKE cluster endpoint"
  value       = module.gke.cluster_endpoint
  sensitive   = true
}

output "kms_keyring_id" {
  description = "Cloud KMS keyring ID"
  value       = module.kms.keyring_id
}

output "load_balancer_ip" {
  description = "Load balancer IP address"
  value       = module.load_balancer.ip_address
}

output "qwen3_tts_service_url" {
  description = "Qwen3-TTS Cloud Run service URL"
  value       = module.qwen3_tts.service_url
}

output "qwen3_tts_model_cache_bucket" {
  description = "Qwen3-TTS model cache GCS bucket"
  value       = module.qwen3_tts.model_cache_bucket
}
