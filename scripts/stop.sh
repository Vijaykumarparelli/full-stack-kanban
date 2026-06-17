#!/bin/bash
set -e
cd "$(dirname "$0")/.."
echo "Stopping PM app..."
docker-compose down
echo "Stopped."
