# Load Balancer Module

# Reserve static IP address
resource "google_compute_global_address" "default" {
  name = "${var.environment}-lb-ip"
}

# SSL Certificate (managed)
resource "google_compute_managed_ssl_certificate" "default" {
  name = "${var.environment}-ssl-cert"
  
  managed {
    domains = var.domains
  }
}

# Backend service for Cloud Run
resource "google_compute_backend_service" "default" {
  name                  = "${var.environment}-backend"
  protocol              = "HTTP"
  port_name             = "http"
  timeout_sec           = 30
  enable_cdn            = true
  
  backend {
    group = google_compute_region_network_endpoint_group.cloudrun_neg.id
  }
  
  log_config {
    enable      = true
    sample_rate = 1.0
  }
}

# Network Endpoint Group for Cloud Run
resource "google_compute_region_network_endpoint_group" "cloudrun_neg" {
  name                  = "${var.environment}-cloudrun-neg"
  network_endpoint_type = "SERVERLESS"
  region                = var.region
  
  cloud_run {
    service = var.cloud_run_service_name
  }
}

# URL Map
resource "google_compute_url_map" "default" {
  name            = "${var.environment}-url-map"
  default_service = google_compute_backend_service.default.id
}

# HTTP to HTTPS redirect
resource "google_compute_url_map" "https_redirect" {
  name = "${var.environment}-https-redirect"
  
  default_url_redirect {
    https_redirect         = true
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
    strip_query            = false
  }
}

# Target HTTPS proxy
resource "google_compute_target_https_proxy" "default" {
  name             = "${var.environment}-https-proxy"
  url_map          = google_compute_url_map.default.id
  ssl_certificates = [google_compute_managed_ssl_certificate.default.id]
}

# Target HTTP proxy (for redirect)
resource "google_compute_target_http_proxy" "default" {
  name    = "${var.environment}-http-proxy"
  url_map = google_compute_url_map.https_redirect.id
}

# Global forwarding rule (HTTPS)
resource "google_compute_global_forwarding_rule" "https" {
  name                  = "${var.environment}-https-forwarding-rule"
  ip_protocol           = "TCP"
  load_balancing_scheme = "EXTERNAL"
  port_range            = "443"
  target                = google_compute_target_https_proxy.default.id
  ip_address            = google_compute_global_address.default.id
}

# Global forwarding rule (HTTP)
resource "google_compute_global_forwarding_rule" "http" {
  name                  = "${var.environment}-http-forwarding-rule"
  ip_protocol           = "TCP"
  load_balancing_scheme = "EXTERNAL"
  port_range            = "80"
  target                = google_compute_target_http_proxy.default.id
  ip_address            = google_compute_global_address.default.id
}

# Cloud Armor security policy
resource "google_compute_security_policy" "default" {
  name = "${var.environment}-security-policy"
  
  # Rate limiting rule
  rule {
    action   = "rate_based_ban"
    priority = "1000"
    
    match {
      versioned_expr = "SRC_IPS_V1"
      
      config {
        src_ip_ranges = ["*"]
      }
    }
    
    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      
      enforce_on_key = "IP"
      
      rate_limit_threshold {
        count        = 100
        interval_sec = 60
      }
      
      ban_duration_sec = 600
    }
  }
  
  # Default rule
  rule {
    action   = "allow"
    priority = "2147483647"
    
    match {
      versioned_expr = "SRC_IPS_V1"
      
      config {
        src_ip_ranges = ["*"]
      }
    }
  }
}
