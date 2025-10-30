# Production Environment Configuration

environment = "prod"
region      = "us-central1"

# Network
subnet_cidr         = "10.2.0.0/24"
vpc_connector_cidr  = "10.10.0.0/28"

# Cloud SQL
database_tier       = "db-custom-8-32768"
database_version    = "POSTGRES_15"
backup_enabled      = true
backup_start_time   = "03:00"
high_availability   = true

# Cloud Storage
storage_location    = "US"
storage_lifecycle_age = 90

# Cloud Run
cloud_run_min_instances = 2
cloud_run_max_instances = 100
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
    max_nodes    = 20
  },
  {
    name         = "lipsync-gpu-pool"
    machine_type = "n1-standard-4"
    gpu_type     = "nvidia-tesla-t4"
    gpu_count    = 1
    min_nodes    = 1
    max_nodes    = 15
  }
]
