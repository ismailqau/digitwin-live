# GKE Module

resource "google_container_cluster" "main" {
  name     = "${var.environment}-gpu-cluster"
  location = var.region
  
  # Enable Autopilot if specified
  enable_autopilot = var.enable_autopilot
  
  # Network configuration
  network    = var.network_id
  subnetwork = var.subnetwork_id
  
  # IP allocation policy for VPC-native cluster
  ip_allocation_policy {
    cluster_ipv4_cidr_block  = "/16"
    services_ipv4_cidr_block = "/22"
  }
  
  # Workload Identity
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }
  
  # Maintenance window
  maintenance_policy {
    daily_maintenance_window {
      start_time = "03:00"
    }
  }
  
  # Monitoring and logging
  monitoring_config {
    enable_components = ["SYSTEM_COMPONENTS", "WORKLOADS"]
    
    managed_prometheus {
      enabled = true
    }
  }
  
  logging_config {
    enable_components = ["SYSTEM_COMPONENTS", "WORKLOADS"]
  }
  
  # Security
  binary_authorization {
    evaluation_mode = "PROJECT_SINGLETON_POLICY_ENFORCE"
  }
  
  # Remove default node pool (we'll create custom ones)
  remove_default_node_pool = !var.enable_autopilot
  initial_node_count       = var.enable_autopilot ? null : 1
  
  # Addons
  addons_config {
    http_load_balancing {
      disabled = false
    }
    horizontal_pod_autoscaling {
      disabled = false
    }
    network_policy_config {
      disabled = false
    }
  }
  
  # Network policy
  network_policy {
    enabled  = true
    provider = "PROVIDER_UNSPECIFIED"
  }
  
  # Release channel
  release_channel {
    channel = "REGULAR"
  }
}

# GPU Node Pools (only if not using Autopilot)
resource "google_container_node_pool" "gpu_pools" {
  for_each = var.enable_autopilot ? {} : { for pool in var.gpu_node_pools : pool.name => pool }
  
  name       = each.value.name
  location   = var.region
  cluster    = google_container_cluster.main.name
  node_count = each.value.min_nodes
  
  autoscaling {
    min_node_count = each.value.min_nodes
    max_node_count = each.value.max_nodes
  }
  
  node_config {
    machine_type = each.value.machine_type
    
    guest_accelerator {
      type  = each.value.gpu_type
      count = each.value.gpu_count
      
      gpu_driver_installation_config {
        gpu_driver_version = "DEFAULT"
      }
    }
    
    disk_size_gb = 100
    disk_type    = "pd-standard"
    
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]
    
    metadata = {
      disable-legacy-endpoints = "true"
    }
    
    workload_metadata_config {
      mode = "GKE_METADATA"
    }
    
    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }
    
    # Taints for GPU nodes
    taint {
      key    = "nvidia.com/gpu"
      value  = "present"
      effect = "NO_SCHEDULE"
    }
  }
  
  management {
    auto_repair  = true
    auto_upgrade = true
  }
}
