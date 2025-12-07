# Environment Configuration

The mobile app supports multiple environment configurations for different deployment scenarios.

## Environment Files

- `.env` - Default development environment (currently using GCP services)
- `.env.example` - Example development environment
- `.env.production` - Production environment with GCP services

## GCP Service URLs

### API Gateway

- **URL**: `https://api-gateway-yrzc7r3fcq-uc.a.run.app`
- **Alternative**: `https://api-gateway-854120816323.us-central1.run.app`

### WebSocket Server

- **URL**: `wss://websocket-server-yrzc7r3fcq-uc.a.run.app`
- **Alternative**: `wss://websocket-server-854120816323.us-central1.run.app`

### Face Processing Service

- **URL**: `https://face-processing-service-yrzc7r3fcq-uc.a.run.app`
- **Alternative**: `https://face-processing-service-854120816323.us-central1.run.app`

### Lipsync Service

- **URL**: `https://face-processing-service-yrzc7r3fcq-uc.a.run.app` (same as face processing)
- **Alternative**: `https://face-processing-service-854120816323.us-central1.run.app`

## Switching Environments

### Use GCP Services (Default)

```bash
# Already configured in .env
pnpm start
```

### Use Local Services

```bash
# Copy local config
cp .env.example .env

# Start local services first
pnpm --filter @clone/api-gateway dev
pnpm --filter @clone/websocket-server dev

# Then start mobile app
pnpm start
```

### Use Production Services

```bash
# Copy production config
cp .env.production .env

# Start mobile app
pnpm start
```

## Network Configuration Notes

### iOS Simulator

- Use `127.0.0.1` or `localhost`
- GCP URLs work directly

### Android Emulator

- Use `10.0.2.2` for local services (special alias to host machine)
- GCP URLs work directly

### Physical Devices

- For local services: Use your computer's local network IP (e.g., `192.168.20.208`)
- For GCP services: URLs work directly over internet

## Environment Variables

| Variable              | Description                      | Example                                                   |
| --------------------- | -------------------------------- | --------------------------------------------------------- |
| `API_URL`             | REST API endpoint                | `https://api-gateway-yrzc7r3fcq-uc.a.run.app`             |
| `WEBSOCKET_URL`       | WebSocket server endpoint        | `wss://websocket-server-yrzc7r3fcq-uc.a.run.app`          |
| `FACE_PROCESSING_URL` | Face processing service endpoint | `https://face-processing-service-yrzc7r3fcq-uc.a.run.app` |
| `LIPSYNC_SERVICE_URL` | Lipsync service endpoint         | `https://face-processing-service-yrzc7r3fcq-uc.a.run.app` |
| `ENVIRONMENT`         | Environment name                 | `development` or `production`                             |
| `DEBUG`               | Enable debug logging             | `true` or `false`                                         |

## Troubleshooting

### Cannot connect to GCP services

1. Check internet connection
2. Verify service URLs are correct
3. Check if services are deployed: `gcloud run services list`

### Cannot connect to local services

1. Ensure services are running locally
2. Check firewall settings
3. For Android emulator, use `10.0.2.2` instead of `localhost`
4. For physical devices, ensure device and computer are on same network

### WebSocket connection fails

1. Check if WebSocket server is healthy: `curl https://websocket-server-854120816323.us-central1.run.app/health`
2. Verify auth token is valid
3. Check network logs in React Native debugger
