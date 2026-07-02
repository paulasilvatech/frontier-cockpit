FROM alpine:3.20

RUN apk add --no-cache curl python3 zsh

WORKDIR /app/local-otel

COPY materialize-copilot-sessions.sh \
  daily-rollup.sh \
  ./
COPY jobs/jobs-loop.zsh /app/jobs-loop.zsh

RUN chmod +x \
  /app/jobs-loop.zsh \
  /app/local-otel/materialize-copilot-sessions.sh \
  /app/local-otel/daily-rollup.sh

ENV FRONTIER_SKIP_ENV_ZSH=true
ENV TEMPO_URL=http://tempo:3200
ENV PROMETHEUS_URL=http://prometheus:9090
ENV OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=http://otel-collector:4318/v1/metrics
ENV OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=http://otel-collector:4318/v1/logs
ENV COPILOT_MATERIALIZE_STATE_FILE=/state/materialized-traces.json
ENV JOBS_MATERIALIZE_INTERVAL_SECONDS=300
ENV JOBS_ROLLUP_INTERVAL_SECONDS=86400

CMD ["zsh", "/app/jobs-loop.zsh"]
