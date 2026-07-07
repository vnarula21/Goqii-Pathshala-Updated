FROM python:3.11-slim

# ffmpeg        = mp3 -> wav transcode + video stitching
# libreoffice   = pptx -> pdf (headless, free; replaces CloudConvert)
# poppler-utils = pdftoppm: pdf -> per-slide PNG
# fonts         = so slide text renders correctly in the conversion
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libreoffice-impress \
    libreoffice-core \
    poppler-utils \
    fonts-liberation \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

# Hugging Face Spaces expect 7860; Cloud Run injects $PORT (8080) and overrides this.
ENV PORT=7860
EXPOSE 7860

CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT} --workers 1"]
