FROM python:3.12-slim
WORKDIR /app
COPY shared/requirements.txt /app/shared/requirements.txt
RUN pip install --no-cache-dir -r /app/shared/requirements.txt
COPY shared /app/shared
COPY services/onboarding /app/services/onboarding
ENV PYTHONPATH=/app
CMD ["uvicorn", "services.onboarding.app.main:app", "--host", "0.0.0.0", "--port", "8002"]
