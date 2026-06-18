# Stage 1: Build frontend
# TODO: Pin to digest in production: docker pull node:22-alpine && docker inspect node:22-alpine | grep Id
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Python backend
# TODO: Pin to digest in production: docker pull python:3.12-slim && docker inspect python:3.12-slim | grep Id
FROM python:3.12-slim
WORKDIR /app

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./

# Copy built frontend into backend static dir
COPY --from=frontend-build /app/frontend/out ./static

EXPOSE 8000

RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
USER appuser

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
