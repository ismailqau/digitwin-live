# Qwen3-TTS Module Outputs

output "service_url" {
  description = "Qwen3-TTS Cloud Run service URL"
  value       = google_cloud_run_v2_service.qwen3_tts.uri
}

output "service_name" {
  description = "Qwen3-TTS Cloud Run service name"
  value       = google_cloud_run_v2_service.qwen3_tts.name
}

output "model_cache_bucket" {
  description = "GCS bucket name for model weight caching"
  value       = google_storage_bucket.model_cache.name
}

output "service_account_email" {
  description = "Service account email for the Qwen3-TTS service"
  value       = google_service_account.qwen3_tts.email
}
