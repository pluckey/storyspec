FROM python:3.13-slim
WORKDIR /srv
COPY pyproject.toml ./
RUN pip install --no-cache-dir "fastapi>=0.115" "uvicorn>=0.30" "psycopg[binary]>=3.2" "pyjwt>=2.9"
COPY app ./app
EXPOSE 8000
HEALTHCHECK --interval=2s --timeout=2s --retries=30 CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/tags')"
CMD ["uvicorn", "app.entry.http:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000"]
