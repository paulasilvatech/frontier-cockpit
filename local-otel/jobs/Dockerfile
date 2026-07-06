FROM docker.io/library/python:3.14-slim

# zsh runs the job scripts; curl serves healthchecks and OTLP posts; duckdb
# powers the local analytics store (developer_daily_rollup) and the long-term
# history snapshot the dashboard API reads.
RUN apt-get update -q \
  && apt-get install -y -q --no-install-recommends zsh curl \
  && rm -rf /var/lib/apt/lists/* \
  && pip install --no-cache-dir duckdb

WORKDIR /app/local-otel

COPY materialize-copilot-sessions.sh \
  daily-rollup.sh \
  audit-coverage.sh \
  frontier-local-insights.sh \
  export-otel-duckdb.sh \
  ./
COPY jobs/jobs-loop.zsh /app/jobs-loop.zsh

RUN chmod +x \
  /app/jobs-loop.zsh \
  /app/local-otel/materialize-copilot-sessions.sh \
  /app/local-otel/daily-rollup.sh \
  /app/local-otel/audit-coverage.sh \
  /app/local-otel/frontier-local-insights.sh \
  /app/local-otel/export-otel-duckdb.sh

ENV FRONTIER_SKIP_ENV_ZSH=true
ENV TEMPO_URL=http://tempo:3200
ENV PROMETHEUS_URL=http://prometheus:9090
ENV OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=http://otel-collector:4318/v1/metrics
ENV OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=http://otel-collector:4318/v1/logs
ENV COPILOT_MATERIALIZE_STATE_FILE=/state/materialized-traces.json
ENV JOBS_MATERIALIZE_INTERVAL_SECONDS=300
ENV JOBS_ROLLUP_INTERVAL_SECONDS=86400
ENV JOBS_COVERAGE_INTERVAL_SECONDS=3600
ENV LOKI_URL=http://loki:3100
ENV FRONTIER_COVERAGE_SKIP_SETTINGS=true
ENV FRONTIER_PYTHON=/usr/local/bin/python3
ENV FRONTIER_INSIGHTS_DB=/analytics/frontier-insights.duckdb
ENV FRONTIER_OTEL_EXPORT_DB=/analytics/frontier-otel-export.duckdb
ENV FRONTIER_INSIGHTS_SNAPSHOT=/analytics/long-term-history.json

CMD ["zsh", "/app/jobs-loop.zsh"]
