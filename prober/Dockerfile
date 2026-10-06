FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app/src

RUN groupadd --gid 10001 prober \
    && useradd \
      --uid 10001 \
      --gid 10001 \
      --no-create-home \
      --shell /usr/sbin/nologin \
      prober

WORKDIR /app

COPY --chown=10001:10001 src ./src

USER 10001:10001

CMD ["python", "-m", "status_prober.main"]
