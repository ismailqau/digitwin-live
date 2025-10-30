# Cloud SQL Module Outputs

output "connection_name" {
  description = "Connection name for Cloud SQL instance"
  value       = google_sql_database_instance.main.connection_name
}

output "private_ip_address" {
  description = "Private IP address of the instance"
  value       = google_sql_database_instance.main.private_ip_address
}

output "instance_name" {
  description = "Name of the Cloud SQL instance"
  value       = google_sql_database_instance.main.name
}

output "database_name" {
  description = "Name of the main database"
  value       = google_sql_database.main.name
}
