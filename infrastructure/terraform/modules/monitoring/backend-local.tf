# Local backend for testing monitoring module independently
# This allows testing without needing GCS bucket setup

terraform {
  backend "local" {
    path = "terraform.tfstate"
  }
}
