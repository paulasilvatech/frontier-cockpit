FROM docker.io/library/alpine:3.20

RUN apk add --no-cache curl python3 zsh

WORKDIR /app/local-otel

COPY register-model-price.sh \
  seed-model-prices.sh \
  ./
COPY registry/registry-loop.zsh /app/registry-loop.zsh

RUN chmod +x \
  /app/registry-loop.zsh \
  /app/local-otel/register-model-price.sh \
  /app/local-otel/seed-model-prices.sh

ENV FRONTIER_SKIP_ENV_ZSH=true
ENV OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=http://otel-collector:4318/v1/metrics
ENV REGISTRY_REFRESH_SECONDS=300

CMD ["zsh", "/app/registry-loop.zsh"]
