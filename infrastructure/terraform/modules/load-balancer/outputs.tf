# Load Balancer Module Outputs

output "ip_address" {
  description = "Load balancer IP address"
  value       = google_compute_global_address.default.address
}

output "ssl_certificate_id" {
  description = "SSL certificate ID"
  value       = google_compute_managed_ssl_certificate.default.id
}

output "backend_service_id" {
  description = "Backend service ID"
  value       = google_compute_backend_service.default.id
}
