-- Keeps the free-tier Render service (edge-tts, used for narration, video
-- generation, and now module thumbnails) from falling asleep after ~15
-- minutes of inactivity, which was causing the first request after a quiet
-- period to take a very long time (cold start: waking the server, loading
-- LibreOffice, etc). Pinging its lightweight /health endpoint every 10
-- minutes keeps it warm at no extra cost.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'keep-render-tts-service-awake',
  '*/10 * * * *',
  $$
  SELECT net.http_get(
    url := 'https://goqii-pathshala-updated.onrender.com/health'
  );
  $$
);
