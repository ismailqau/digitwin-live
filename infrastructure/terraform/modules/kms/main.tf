# Cloud KMS Module

resource "google_kms_key_ring" "main" {
  name     = "${var.environment}-keyring"
  location = var.region
}

resource "google_kms_crypto_key" "database" {
  name     = "${var.environment}-database-key"
  key_ring = google_kms_key_ring.main.id
  
  rotation_period = "7776000s" # 90 days
  
  lifecycle {
    prevent_destroy = true
  }
}

resource "google_kms_crypto_key" "storage" {
  name     = "${var.environment}-storage-key"
  key_ring = google_kms_key_ring.main.id
  
  rotation_period = "7776000s" # 90 days
  
  lifecycle {
    prevent_destroy = true
  }
}

resource "google_kms_crypto_key" "secrets" {
  name     = "${var.environment}-secrets-key"
  key_ring = google_kms_key_ring.main.id
  
  rotation_period = "7776000s" # 90 days
  
  lifecycle {
    prevent_destroy = true
  }
}

# IAM binding for Cloud SQL to use KMS key
resource "google_kms_crypto_key_iam_member" "sql_encrypter_decrypter" {
  crypto_key_id = google_kms_crypto_key.database.id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = "serviceAccount:service-${data.google_project.current.number}@gcp-sa-cloud-sql.iam.gserviceaccount.com"
}

# IAM binding for Cloud Storage to use KMS key
resource "google_kms_crypto_key_iam_member" "storage_encrypter_decrypter" {
  crypto_key_id = google_kms_crypto_key.storage.id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = "serviceAccount:service-${data.google_project.current.number}@gs-project-accounts.iam.gserviceaccount.com"
}

data "google_project" "current" {
  project_id = var.project_id
}
