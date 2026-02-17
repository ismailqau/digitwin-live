# Development Environment Configuration

environment = "dev"
region      = "us-central1"

# Network
subnet_cidr         = "10.0.0.0/24"
vpc_connector_cidr  = "10.8.0.0/28"

# Cloud SQL
database_tier       = "db-custom-2-8192"
database_version    = "POSTGRES_15"
backup_enabled      = true
backup_start_time   = "03:00"
high_availability   = false

# Cloud Storage
storage_location    = "US"
storage_lifecycle_age = 30

# Cloud Run
cloud_run_min_instances = 0
cloud_run_max_instances = 10
cloud_run_concurrency   = 50
cloud_run_cpu           = "1000m"
cloud_run_memory        = "1Gi"

# GKE
gke_enable_autopilot = true
gke_gpu_node_pools = [
  {
    name         = "tts-gpu-pool"
    machine_type = "n1-standard-2"
    gpu_type     = "nvidia-tesla-t4"
    gpu_count    = 1
    min_nodes    = 0
    max_nodes    = 5
  },
  {
    name         = "lipsync-gpu-pool"
    machine_type = "n1-standard-2"
    gpu_type     = "nvidia-tesla-t4"
    gpu_count    = 1
    min_nodes    = 0
    max_nodes    = 3
  }
]

# Qwen3-TTS
qwen3_tts_image = "us-central1-docker.pkg.dev/digitwinlive/digitwinlive/qwen3-tts-service:latest"
