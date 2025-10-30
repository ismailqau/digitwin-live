# Cloud KMS Module Outputs

output "keyring_id" {
  description = "KMS keyring ID"
  value       = google_kms_key_ring.main.id
}

output "database_key_id" {
  description = "Database encryption key ID"
  value       = google_kms_crypto_key.database.id
}

output "storage_key_id" {
  description = "Storage encryption key ID"
  value       = google_kms_crypto_key.storage.id
}

output "secrets_key_id" {
  description = "Secrets encryption key ID"
  value       = google_kms_crypto_key.secrets.id
}
