# Training jobs for the three models. Not a server: each run trains, tests,
# publishes its results to MySQL and exits.
#
#   docker compose --profile ml run --rm ml forecast
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY b2b_ml b2b_ml

# Run as an unprivileged user; it only needs to write saved model files.
RUN useradd --create-home trainer && mkdir models && chown trainer models
USER trainer

ENTRYPOINT ["python", "-m", "b2b_ml"]
CMD ["--help"]
