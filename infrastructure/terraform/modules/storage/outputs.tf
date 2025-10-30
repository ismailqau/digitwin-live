# Cloud Storage Module Outputs

output "bucket_names" {
  description = "Map of bucket names"
  value = {
    voice_models         = google_storage_bucket.voice_models.name
    face_models          = google_storage_bucket.face_models.name
    documents            = google_storage_bucket.documents.name
    conversation_history = google_storage_bucket.conversation_history.name
    terraform_state      = google_storage_bucket.terraform_state.name
  }
}

output "voice_models_bucket" {
  description = "Voice models bucket name"
  value       = google_storage_bucket.voice_models.name
}

output "face_models_bucket" {
  description = "Face models bucket name"
  value       = google_storage_bucket.face_models.name
}

output "documents_bucket" {
  description = "Documents bucket name"
  value       = google_storage_bucket.documents.name
}
