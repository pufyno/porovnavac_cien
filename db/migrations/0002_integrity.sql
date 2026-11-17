-- 0002_integrity: poistky, na ktoré sa spolieha výpočet štatistík.

-- Ponuky nemajú vlastný stĺpec meny; ceny v rámci krajiny sa porovnávajú priamo,
-- preto musí mať každý e-shop menu svojej krajiny.
ALTER TABLE shops ADD CONSTRAINT shops_currency_matches_country
  CHECK ((country = 'SK' AND currency = 'EUR') OR (country = 'CZ' AND currency = 'CZK'));

-- Rovnako ako pri ponukách: najviac jeden otvorený interval na produkt a krajinu.
CREATE UNIQUE INDEX product_price_history_open
  ON product_price_history (product_id, country) WHERE valid_to IS NULL;
