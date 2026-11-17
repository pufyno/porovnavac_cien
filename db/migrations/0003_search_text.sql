-- 0003_search_text: značka sa do vyhľadávacieho textu pridá len vtedy, keď ešte
-- nie je v názve. Feedy názov bežne uvádzajú aj so značkou a zdvojenie
-- („roborock roborock s8“) zhoršovalo podobnosť pri vyhľadávaní.
DROP INDEX products_search_trgm;
ALTER TABLE products DROP COLUMN search_text;
ALTER TABLE products ADD COLUMN search_text text GENERATED ALWAYS AS (
  lower(f_unaccent(
    CASE WHEN brand IS NULL OR strpos(lower(name), lower(brand)) > 0 THEN name
         ELSE brand || ' ' || name END
  ))
) STORED;
CREATE INDEX products_search_trgm ON products USING gin (search_text gin_trgm_ops);
