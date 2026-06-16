FROM python:3.12-slim
WORKDIR /app
COPY shared/requirements.txt /app/shared/requirements.txt
RUN pip install --no-cache-dir -r /app/shared/requirements.txt
COPY shared /app/shared
COPY workers/notification /app/workers/notification
ENV PYTHONPATH=/app
CMD ["python", "workers/notification/main.py"]
