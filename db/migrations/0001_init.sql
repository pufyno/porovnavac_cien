-- 0001_init: základná schéma (e-shopy, produkty, ponuky, história cien, alerty, prekliky)
-- Cieľ: PostgreSQL 17. Ceny sú v mene e-shopu (EUR pre SK, CZK pre CZ).

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS citext;

-- unaccent() nie je IMMUTABLE, preto obal použiteľný v indexoch a generovaných stĺpcoch
CREATE FUNCTION f_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  RETURN public.unaccent('public.unaccent'::regdictionary, $1);

-- 1. E-shopy a affiliate konfigurácia ---------------------------------------
CREATE TABLE affiliate_networks (
  id    smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code  text NOT NULL UNIQUE,                 -- dognet | ehub | cj | heureka
  name  text NOT NULL
);

CREATE TABLE shops (
  id           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug         text NOT NULL UNIQUE,
  name         text NOT NULL,
  country      char(2) NOT NULL CHECK (country IN ('SK','CZ')),
  currency     char(3) NOT NULL CHECK (currency IN ('EUR','CZK')),
  website_url  text NOT NULL,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE shop_feeds (
  id                 integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shop_id            integer NOT NULL REFERENCES shops ON DELETE CASCADE,
  network_id         smallint NOT NULL REFERENCES affiliate_networks,
  feed_url           text NOT NULL,
  feed_format        text NOT NULL DEFAULT 'heureka',
  deeplink_template  text NOT NULL,           -- '...click?a_aid=XYZ&data1={click_id}&desturl={url}'
  commission_pct     numeric(5,2),
  is_active          boolean NOT NULL DEFAULT true,
  UNIQUE (shop_id, network_id)
);

CREATE TABLE feed_imports (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  feed_id        integer NOT NULL REFERENCES shop_feeds ON DELETE CASCADE,
  started_at     timestamptz NOT NULL DEFAULT now(),
  finished_at    timestamptz,
  status         text NOT NULL DEFAULT 'running'
                 CHECK (status IN ('running','ok','failed','rejected')),
  items_total    integer,
  items_changed  integer,
  error          text
);

-- 2. Master produkty --------------------------------------------------------
CREATE TABLE products (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name         text NOT NULL,
  brand        text,
  category     text,
  image_url    text,
  search_text  text GENERATED ALWAYS AS
               (lower(f_unaccent(coalesce(brand || ' ', '') || name))) STORED,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX products_search_trgm ON products USING gin (search_text gin_trgm_ops);

CREATE TABLE product_eans (
  ean         varchar(14) PRIMARY KEY CHECK (ean ~ '^[0-9]{8,14}$'),
  product_id  bigint NOT NULL REFERENCES products ON DELETE CASCADE
);
CREATE INDEX product_eans_product ON product_eans (product_id);

-- 3. Ponuky e-shopov --------------------------------------------------------
CREATE TABLE offers (
  id                     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shop_id                integer NOT NULL REFERENCES shops,
  external_id            text NOT NULL,       -- ITEM_ID z feedu
  product_id             bigint REFERENCES products ON DELETE SET NULL,  -- NULL = nespárované
  match_method           text CHECK (match_method IN ('ean','fuzzy','manual')),
  ean                    varchar(14),
  name                   text NOT NULL,
  url                    text NOT NULL,
  price                  numeric(10,2) NOT NULL CHECK (price > 0),
  list_price             numeric(10,2),       -- "pôvodná" cena, ak ju feed uvádza
  delivery_days          smallint,            -- 0 = skladom, NULL = neznáme
  is_active              boolean NOT NULL DEFAULT true,
  min_price_30d          numeric(10,2),       -- cache z histórie
  fake_discount_warning  boolean NOT NULL DEFAULT false,
  warning_detail         text,
  first_seen_on          date NOT NULL DEFAULT current_date,
  last_seen_on           date NOT NULL DEFAULT current_date,
  UNIQUE (shop_id, external_id)
);
CREATE INDEX offers_by_product ON offers (product_id, price) WHERE is_active;
CREATE INDEX offers_unmatched  ON offers (ean) WHERE product_id IS NULL;

-- 4. História cien: riadok len pri ZMENE ceny (interval platnosti) ----------
CREATE TABLE offer_price_history (
  offer_id    bigint NOT NULL REFERENCES offers ON DELETE CASCADE,
  valid_from  date NOT NULL,
  valid_to    date,                           -- exkluzívne; NULL = platí dodnes
  price       numeric(10,2) NOT NULL,
  list_price  numeric(10,2),
  PRIMARY KEY (offer_id, valid_from),
  CHECK (valid_to IS NULL OR valid_to > valid_from)
);
CREATE UNIQUE INDEX offer_price_history_open
  ON offer_price_history (offer_id) WHERE valid_to IS NULL;

-- najnižšia cena produktu v krajine, tiež len pri zmene
CREATE TABLE product_price_history (
  product_id  bigint NOT NULL REFERENCES products ON DELETE CASCADE,
  country     char(2) NOT NULL,
  valid_from  date NOT NULL,
  valid_to    date,
  min_price   numeric(10,2) NOT NULL,
  PRIMARY KEY (product_id, country, valid_from),
  CHECK (valid_to IS NULL OR valid_to > valid_from)
);

-- predpočítané štatistiky, z ktorých číta API
CREATE TABLE product_price_stats (
  product_id    bigint NOT NULL REFERENCES products ON DELETE CASCADE,
  country       char(2) NOT NULL,
  currency      char(3) NOT NULL,
  current_min   numeric(10,2),
  avg_30d       numeric(10,2),
  avg_90d       numeric(10,2),
  min_90d       numeric(10,2),
  history_days  smallint NOT NULL DEFAULT 0,  -- koľko dní histórie reálne máme
  offers_count  smallint NOT NULL DEFAULT 0,
  computed_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, country)
);

-- 5. Strážne psy ------------------------------------------------------------
CREATE TABLE price_alerts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    bigint NOT NULL REFERENCES products ON DELETE CASCADE,
  country       char(2) NOT NULL,
  email         citext NOT NULL,
  target_price  numeric(10,2) NOT NULL CHECK (target_price > 0),
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','active','triggered','cancelled')),
  token         uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,  -- potvrdenie aj odhlásenie
  source        text,                         -- chatgpt | gemini | claude | web
  created_at    timestamptz NOT NULL DEFAULT now(),
  confirmed_at  timestamptz,
  triggered_at  timestamptz,
  UNIQUE (product_id, country, email)
);
CREATE INDEX price_alerts_active ON price_alerts (product_id, country) WHERE status = 'active';

-- 6. Prekliky (bez FK a bez IP: rýchly zápis, anonymné) ---------------------
CREATE TABLE click_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),  -- posiela sa sieti ako sub-ID
  clicked_at  timestamptz NOT NULL DEFAULT now(),
  offer_id    bigint NOT NULL,
  shop_id     integer NOT NULL,
  product_id  bigint,
  source      text NOT NULL DEFAULT 'unknown',
  price       numeric(10,2),
  alert_id    uuid
);
CREATE INDEX click_logs_time ON click_logs USING brin (clicked_at);
