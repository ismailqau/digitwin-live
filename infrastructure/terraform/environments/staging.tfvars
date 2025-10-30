# Staging Environment Configuration

environment = "staging"
region      = "us-central1"

# Network
subnet_cidr         = "10.1.0.0/24"
vpc_connector_cidr  = "10.9.0.0/28"

# Cloud SQL
database_tier       = "db-custom-4-16384"
database_version    = "POSTGRES_15"
backup_enabled      = true
backup_start_time   = "03:00"
high_availability   = false

# Cloud Storage
storage_location    = "US"
storage_lifecycle_age = 60

# Cloud Run
cloud_run_min_instances = 1
cloud_run_max_instances = 50
cloud_run_concurrency   = 50
cloud_run_cpu           = "2000m"
cloud_run_memory        = "2Gi"

# GKE
gke_enable_autopilot = true
gke_gpu_node_pools = [
  {
    name         = "tts-gpu-pool"
    machine_type = "n1-standard-4"
    gpu_type     = "nvidia-tesla-t4"
    gpu_count    = 1
    min_nodes    = 1
    max_nodes    = 10
  },
  {
    name         = "lipsync-gpu-pool"
    machine_type = "n1-standard-4"
    gpu_type     = "nvidia-tesla-t4"
    gpu_count    = 1
    min_nodes    = 1
    max_nodes    = 8
  }
]
