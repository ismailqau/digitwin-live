# Cloud Storage Module

# Voice Models Bucket
resource "google_storage_bucket" "voice_models" {
  name          = "${var.project_id}-${var.environment}-voice-models"
  location      = var.location
  force_destroy = var.environment != "prod"
  
  uniform_bucket_level_access = true
  
  versioning {
    enabled = true
  }
  
  lifecycle_rule {
    condition {
      age = var.lifecycle_age
    }
    action {
      type = "Delete"
    }
  }
  
  encryption {
    default_kms_key_name = var.kms_key_name
  }
  
  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD", "PUT", "POST", "DELETE"]
    response_header = ["*"]
    max_age_seconds = 3600
  }
}

# Face Models Bucket
resource "google_storage_bucket" "face_models" {
  name          = "${var.project_id}-${var.environment}-face-models"
  location      = var.location
  force_destroy = var.environment != "prod"
  
  uniform_bucket_level_access = true
  
  versioning {
    enabled = true
  }
  
  lifecycle_rule {
    condition {
      age = var.lifecycle_age
    }
    action {
      type = "Delete"
    }
  }
  
  encryption {
    default_kms_key_name = var.kms_key_name
  }
}

# Documents Bucket
resource "google_storage_bucket" "documents" {
  name          = "${var.project_id}-${var.environment}-documents"
  location      = var.location
  force_destroy = var.environment != "prod"
  
  uniform_bucket_level_access = true
  
  versioning {
    enabled = true
  }
  
  lifecycle_rule {
    condition {
      age = var.lifecycle_age
    }
    action {
      type = "Delete"
    }
  }
  
  encryption {
    default_kms_key_name = var.kms_key_name
  }
}

# Conversation History Bucket
resource "google_storage_bucket" "conversation_history" {
  name          = "${var.project_id}-${var.environment}-conversations"
  location      = var.location
  force_destroy = var.environment != "prod"
  
  uniform_bucket_level_access = true
  
  versioning {
    enabled = false
  }
  
  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type = "Delete"
    }
  }
  
  encryption {
    default_kms_key_name = var.kms_key_name
  }
}

# Terraform State Bucket (created separately for each environment)
resource "google_storage_bucket" "terraform_state" {
  name          = "${var.project_id}-${var.environment}-tfstate"
  location      = var.location
  force_destroy = false
  
  uniform_bucket_level_access = true
  
  versioning {
    enabled = true
  }
  
  lifecycle_rule {
    condition {
      num_newer_versions = 10
    }
    action {
      type = "Delete"
    }
  }
}
