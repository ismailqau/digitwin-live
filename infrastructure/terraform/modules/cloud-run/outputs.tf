# Cloud Run Module Outputs

output "service_urls" {
  description = "Cloud Run service URLs"
  value = {
    websocket_server = google_cloud_run_service.websocket_server.status[0].url
    api_gateway      = google_cloud_run_service.api_gateway.status[0].url
  }
}

output "websocket_server_url" {
  description = "WebSocket server URL"
  value       = google_cloud_run_service.websocket_server.status[0].url
}

output "api_gateway_url" {
  description = "API Gateway URL"
  value       = google_cloud_run_service.api_gateway.status[0].url
}
