FROM python:3.12-slim
WORKDIR /app
COPY shared/requirements.txt /app/shared/requirements.txt
RUN pip install --no-cache-dir -r /app/shared/requirements.txt
COPY shared /app/shared
COPY services/auth /app/services/auth
COPY services/verification /app/services/verification
ENV PYTHONPATH=/app
CMD ["uvicorn", "services.verification.app.main:app", "--host", "0.0.0.0", "--port", "8004"]
