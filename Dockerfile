FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY virtual_team/ ./virtual_team/
COPY webapp.py .

EXPOSE 8080

CMD ["python", "webapp.py"]
