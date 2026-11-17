-- 0004_alert_emails: údaje pre obmedzenie opakovaných e-mailov a pre mazanie
-- starých strážení (nepotvrdené po 7 dňoch, ukončené po 30 dňoch).
ALTER TABLE price_alerts
  ADD COLUMN last_email_at timestamptz,
  ADD COLUMN updated_at    timestamptz NOT NULL DEFAULT now();
