# Qwen3-TTS Cloud Run + GCS Module

locals {
  gpu_configs = {
    dev = {
      gpu_type        = "nvidia-tesla-t4"
      gpu_count       = 1
      machine_type    = "n1-standard-4"
      memory_limit    = "16Gi"
      cpu_limit       = "4"
      min_instances   = 0
      max_instances   = 1
      flash_attention = false
    }
    staging = {
      gpu_type        = "nvidia-tesla-t4"
      gpu_count       = 1
      machine_type    = "n1-standard-4"
      memory_limit    = "16Gi"
      cpu_limit       = "4"
      min_instances   = 0
      max_instances   = 1
      flash_attention = false
    }
    production = {
      gpu_type        = "nvidia-l4"
      gpu_count       = 1
      machine_type    = "g2-standard-8"
      memory_limit    = "32Gi"
      cpu_limit       = "8"
      min_instances   = 1
      max_instances   = 5
      flash_attention = true
    }
  }

  config = local.gpu_configs[var.environment]
}

# -------------------------------------------------------------------
# GCS bucket for model weight caching
# -------------------------------------------------------------------
resource "google_storage_bucket" "model_cache" {
  name          = "${var.project_id}-qwen3-tts-models-${var.environment}"
  location      = var.region
  force_destroy = var.environment != "production"

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
}

# -------------------------------------------------------------------
# Service account
# -------------------------------------------------------------------
resource "google_service_account" "qwen3_tts" {
  account_id   = "qwen3-tts-${var.environment}"
  display_name = "Qwen3-TTS Service (${var.environment})"
}

resource "google_storage_bucket_iam_member" "model_cache_reader" {
  bucket = google_storage_bucket.model_cache.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.qwen3_tts.email}"
}


# -------------------------------------------------------------------
# Cloud Run service with GPU
# -------------------------------------------------------------------
resource "google_cloud_run_v2_service" "qwen3_tts" {
  provider = google-beta
  name     = "${var.environment}-qwen3-tts"
  location = var.region

  template {
    service_account = google_service_account.qwen3_tts.email

    scaling {
      min_instance_count = local.config.min_instances
      max_instance_count = local.config.max_instances
    }

    containers {
      image = var.image

      resources {
        limits = {
          cpu              = local.config.cpu_limit
          memory           = local.config.memory_limit
          "nvidia.com/gpu" = "1"
        }
      }

      ports {
        container_port = 8080
      }

      # Service configuration
      env {
        name  = "HOST"
        value = "0.0.0.0"
      }
      env {
        name  = "MODEL_CACHE_DIR"
        value = "/app/models"
      }
      env {
        name  = "CUSTOM_VOICE_MODEL"
        value = "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice"
      }
      env {
        name  = "BASE_MODEL"
        value = "Qwen/Qwen3-TTS-12Hz-1.7B-Base"
      }
      env {
        name  = "TOKENIZER_MODEL"
        value = "Qwen/Qwen3-TTS-Tokenizer-12Hz"
      }
      env {
        name  = "CUDA_VISIBLE_DEVICES"
        value = "0"
      }
      env {
        name  = "MAX_TEXT_LENGTH"
        value = "2000"
      }
      env {
        name  = "GCS_MODEL_BUCKET"
        value = google_storage_bucket.model_cache.name
      }
      env {
        name  = "USE_VLLM"
        value = var.environment == "production" ? "true" : "false"
      }

      startup_probe {
        http_get {
          path = "/ready"
          port = 8080
        }
        initial_delay_seconds = 120
        period_seconds        = 10
        timeout_seconds       = 5
        failure_threshold     = 12
      }

      liveness_probe {
        http_get {
          path = "/health"
          port = 8080
        }
        period_seconds    = 30
        timeout_seconds   = 10
        failure_threshold = 3
      }
    }

    annotations = {
      "run.googleapis.com/cpu-throttling"                = "false"
      "run.googleapis.com/launch-stage"                  = "BETA"
      "run.googleapis.com/accelerator"                   = local.config.gpu_type
      "run.googleapis.com/accelerator-count"             = tostring(local.config.gpu_count)
      "run.googleapis.com/gpu-zonal-redundancy-disabled" = "true"
    }

    dynamic "vpc_access" {
      for_each = var.vpc_connector_id != "" ? [1] : []
      content {
        connector = var.vpc_connector_id
        egress    = "PRIVATE_RANGES_ONLY"
      }
    }
  }
}
