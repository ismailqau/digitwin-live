# Cloud Run Module

# WebSocket Server
resource "google_cloud_run_service" "websocket_server" {
  name     = "${var.environment}-websocket-server"
  location = var.region
  
  template {
    metadata {
      annotations = {
        "autoscaling.knative.dev/minScale"      = var.min_instances
        "autoscaling.knative.dev/maxScale"      = var.max_instances
        "run.googleapis.com/vpc-access-connector" = var.vpc_connector_id
        "run.googleapis.com/vpc-access-egress"    = "private-ranges-only"
        "run.googleapis.com/cpu-throttling"       = "false"
      }
    }
    
    spec {
      container_concurrency = var.concurrency
      timeout_seconds       = 300
      
      containers {
        image = "${var.region}-docker.pkg.dev/${var.project_id}/${var.environment}/websocket-server:latest"
        
        resources {
          limits = {
            cpu    = var.cpu
            memory = var.memory
          }
        }
        
        env {
          name  = "ENVIRONMENT"
          value = var.environment
        }
        
        env {
          name  = "DATABASE_CONNECTION"
          value = var.database_connection
        }
        
        env {
          name = "DATABASE_PASSWORD"
          value_from {
            secret_key_ref {
              name = "${var.environment}-db-password"
              key  = "latest"
            }
          }
        }
        
        ports {
          name           = "http1"
          container_port = 8080
        }
      }
    }
  }
  
  traffic {
    percent         = 100
    latest_revision = true
  }
  
  autogenerate_revision_name = true
}

# API Gateway
resource "google_cloud_run_service" "api_gateway" {
  name     = "${var.environment}-api-gateway"
  location = var.region
  
  template {
    metadata {
      annotations = {
        "autoscaling.knative.dev/minScale"      = var.min_instances
        "autoscaling.knative.dev/maxScale"      = var.max_instances
        "run.googleapis.com/vpc-access-connector" = var.vpc_connector_id
        "run.googleapis.com/vpc-access-egress"    = "private-ranges-only"
      }
    }
    
    spec {
      container_concurrency = var.concurrency
      
      containers {
        image = "${var.region}-docker.pkg.dev/${var.project_id}/${var.environment}/api-gateway:latest"
        
        resources {
          limits = {
            cpu    = var.cpu
            memory = var.memory
          }
        }
        
        env {
          name  = "ENVIRONMENT"
          value = var.environment
        }
        
        env {
          name  = "DATABASE_CONNECTION"
          value = var.database_connection
        }
        
        ports {
          name           = "http1"
          container_port = 8080
        }
      }
    }
  }
  
  traffic {
    percent         = 100
    latest_revision = true
  }
  
  autogenerate_revision_name = true
}

# IAM policy to allow public access
resource "google_cloud_run_service_iam_member" "websocket_public" {
  service  = google_cloud_run_service.websocket_server.name
  location = google_cloud_run_service.websocket_server.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_service_iam_member" "api_public" {
  service  = google_cloud_run_service.api_gateway.name
  location = google_cloud_run_service.api_gateway.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}
