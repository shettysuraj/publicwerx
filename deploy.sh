#!/bin/bash
set -e

echo "=== publicwerx deploy ==="

cd "$(dirname "$0")"

echo "--- git pull ---"
git pull origin main

echo "--- syntax check ---"
node --check backend/src/index.js

echo "--- backend npm ci ---"
cd backend
npm ci --omit=dev
cd ..

echo "--- frontend build ---"
cd frontend
npm ci
npx vite build
cd ..

echo "--- pm2 restart ---"
pm2 restart publicwerx || pm2 start backend/src/index.js --name publicwerx

echo "--- health check ---"
sleep 2
curl -sf http://localhost:3016/health || echo "WARN: health check failed"

echo "=== deploy complete ==="
