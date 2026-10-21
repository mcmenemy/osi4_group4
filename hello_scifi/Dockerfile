# Stage 1: build the React frontend.
FROM node:24-slim AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Python backend that also serves the built frontend.
FROM python:3.13-slim
COPY --from=ghcr.io/astral-sh/uv:0.13.1 /uv /bin/uv
WORKDIR /app
COPY backend/pyproject.toml backend/uv.lock ./
RUN UV_PYTHON_DOWNLOADS=never uv sync --frozen --no-dev
COPY backend/app ./app
COPY --from=frontend /frontend/dist ./frontend_dist

ENV FRONTEND_DIST=/app/frontend_dist \
    PATH="/app/.venv/bin:$PATH"
EXPOSE 8000
# Render sets $PORT. --proxy-headers makes request.client the real visitor IP (for rate limiting).
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'
