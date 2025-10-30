# Cloud SQL Module

resource "google_compute_global_address" "private_ip_address" {
  name          = "${var.environment}-sql-private-ip"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = var.network_id
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = var.network_id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_address.name]
}

resource "google_sql_database_instance" "main" {
  name             = "${var.environment}-clone-db"
  database_version = var.database_version
  region           = var.region
  
  deletion_protection = var.environment == "prod" ? true : false
  
  settings {
    tier              = var.database_tier
    availability_type = var.high_availability ? "REGIONAL" : "ZONAL"
    disk_type         = "PD_SSD"
    disk_size         = var.disk_size
    disk_autoresize   = true
    
    backup_configuration {
      enabled                        = var.backup_enabled
      start_time                     = var.backup_start_time
      point_in_time_recovery_enabled = var.environment == "prod" ? true : false
      transaction_log_retention_days = 7
      backup_retention_settings {
        retained_backups = 30
      }
    }
    
    ip_configuration {
      ipv4_enabled    = false
      private_network = var.network_id
      require_ssl     = true
    }
    
    database_flags {
      name  = "max_connections"
      value = "200"
    }
    
    database_flags {
      name  = "shared_buffers"
      value = "4194304" # 4GB in KB
    }
    
    insights_config {
      query_insights_enabled  = true
      query_string_length     = 1024
      record_application_tags = true
      record_client_address   = true
    }
    
    maintenance_window {
      day          = 7 # Sunday
      hour         = 3
      update_track = "stable"
    }
  }
  
  depends_on = [google_service_networking_connection.private_vpc_connection]
}

resource "google_sql_database" "main" {
  name     = "digitwinline"
  instance = google_sql_database_instance.main.name
}

resource "google_sql_user" "main" {
  name     = "app_user"
  instance = google_sql_database_instance.main.name
  password = var.database_password
}

# Create additional databases for different services
resource "google_sql_database" "cache" {
  name     = "cache_db"
  instance = google_sql_database_instance.main.name
}
