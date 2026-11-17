# Setup and initialize Garage Object Storage locally for UMS
param (
    [string]$ComposeFile = "docker-compose.garage.yml"
)

Write-Host "🚀 Starting Garage Object Storage container..." -ForegroundColor Cyan
docker compose -f $ComposeFile up -d

Write-Host "⏳ Waiting for Garage to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Check node status
$nodeId = (docker exec ums_garage /garage node id -q 2>$null)
if (-not $nodeId) {
    Write-Host "❌ Failed to retrieve Garage Node ID. Please check docker logs ums_garage." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Detected Node ID: $nodeId" -ForegroundColor Green

# Assign layout
Write-Host "⚙️ Configuring single-node cluster layout..." -ForegroundColor Cyan
docker exec ums_garage /garage layout assign -z dc1 -c 10G $nodeId
docker exec ums_garage /garage layout apply --version 1

# Create or reuse key
Write-Host "🔑 Ensuring S3 access key exists..." -ForegroundColor Cyan
$keyOutput = docker exec ums_garage /garage key create ums-key 2>&1
Write-Host $keyOutput

# Create bucket
Write-Host "📦 Ensuring bucket 'ums-uploads' exists..." -ForegroundColor Cyan
docker exec ums_garage /garage bucket create ums-uploads 2>$null
docker exec ums_garage /garage bucket allow ums-uploads --read --write --owner --key ums-key

Write-Host "`n🎉 Garage Object Storage is ready for development!" -ForegroundColor Green
Write-Host "Endpoint: http://localhost:3900" -ForegroundColor Yellow
