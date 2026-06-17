FROM python:3.12-slim
WORKDIR /app
COPY shared/requirements.txt /app/shared/requirements.txt
RUN pip install --no-cache-dir -r /app/shared/requirements.txt
COPY shared /app/shared
COPY services/org-site /app/services/org-site
ENV PYTHONPATH=/app
CMD ["uvicorn", "services.org-site.app.main:app", "--host", "0.0.0.0", "--port", "8003"]
