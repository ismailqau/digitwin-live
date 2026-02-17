# Main Terraform configuration for Real-Time Conversational Clone System

terraform {
  required_version = ">= 1.5.0"
  
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
  }
  
  backend "gcs" {
    # Backend configuration will be provided via backend config file
    # See backend-{env}.hcl files
  }
}

# Provider configuration
provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# Enable required APIs
resource "google_project_service" "required_apis" {
  for_each = toset([
    "run.googleapis.com",
    "container.googleapis.com",
    "sqladmin.googleapis.com",
    "storage-api.googleapis.com",
    "cloudkms.googleapis.com",
    "speech.googleapis.com",
    "aiplatform.googleapis.com",
    "compute.googleapis.com",
    "servicenetworking.googleapis.com",
    "vpcaccess.googleapis.com",
    "cloudtrace.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
  ])
  
  service            = each.value
  disable_on_destroy = false
}

# VPC Network
resource "google_compute_network" "main" {
  name                    = "${var.environment}-vpc"
  auto_create_subnetworks = false
  
  depends_on = [google_project_service.required_apis]
}

# Subnet for Cloud Run and GKE
resource "google_compute_subnetwork" "main" {
  name          = "${var.environment}-subnet"
  ip_cidr_range = var.subnet_cidr
  region        = var.region
  network       = google_compute_network.main.id
  
  private_ip_google_access = true
}

# Cloud Router for NAT
resource "google_compute_router" "main" {
  name    = "${var.environment}-router"
  region  = var.region
  network = google_compute_network.main.id
}

# Cloud NAT for outbound connectivity
resource "google_compute_router_nat" "main" {
  name                               = "${var.environment}-nat"
  router                             = google_compute_router.main.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"
}

# VPC Access Connector for Cloud Run
resource "google_vpc_access_connector" "main" {
  name          = "${var.environment}-vpc-connector"
  region        = var.region
  network       = google_compute_network.main.name
  ip_cidr_range = var.vpc_connector_cidr
  
  depends_on = [google_project_service.required_apis]
}

# Cloud SQL Instance
module "cloud_sql" {
  source = "./modules/cloud-sql"
  
  environment         = var.environment
  region              = var.region
  network_id          = google_compute_network.main.id
  database_tier       = var.database_tier
  database_version    = var.database_version
  backup_enabled      = var.backup_enabled
  backup_start_time   = var.backup_start_time
  high_availability   = var.high_availability
}

# Cloud Storage Buckets
module "storage" {
  source = "./modules/storage"
  
  environment     = var.environment
  project_id      = var.project_id
  location        = var.storage_location
  lifecycle_age   = var.storage_lifecycle_age
}

# Cloud Run Services
module "cloud_run" {
  source = "./modules/cloud-run"
  
  environment           = var.environment
  region                = var.region
  project_id            = var.project_id
  vpc_connector_id      = google_vpc_access_connector.main.id
  database_connection   = module.cloud_sql.connection_name
  min_instances         = var.cloud_run_min_instances
  max_instances         = var.cloud_run_max_instances
  concurrency           = var.cloud_run_concurrency
  cpu                   = var.cloud_run_cpu
  memory                = var.cloud_run_memory
}

# GKE Cluster for GPU workloads
module "gke" {
  source = "./modules/gke"
  
  environment       = var.environment
  region            = var.region
  network_id        = google_compute_network.main.id
  subnetwork_id     = google_compute_subnetwork.main.id
  enable_autopilot  = var.gke_enable_autopilot
  gpu_node_pools    = var.gke_gpu_node_pools
}

# Cloud KMS for encryption
module "kms" {
  source = "./modules/kms"
  
  environment = var.environment
  region      = var.region
  project_id  = var.project_id
}

# Load Balancer
module "load_balancer" {
  source = "./modules/load-balancer"
  
  environment = var.environment
  project_id  = var.project_id
  region      = var.region
}

# Monitoring and Alerting
module "monitoring" {
  source = "./modules/monitoring"
  
  environment         = var.environment
  project_id          = var.project_id
  alert_email         = var.alert_email
  discord_webhook_url = var.discord_webhook_url
}

# Qwen3-TTS Service (GPU-accelerated TTS with voice cloning)
module "qwen3_tts" {
  source = "./modules/qwen3-tts"

  environment      = var.environment
  region           = var.region
  project_id       = var.project_id
  image            = var.qwen3_tts_image
  vpc_connector_id = google_vpc_access_connector.main.id
}
