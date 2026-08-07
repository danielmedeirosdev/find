-- Remove banner: galeria + logo cobrem a identidade visual

ALTER TABLE shops DROP COLUMN IF EXISTS banner_url;

NOTIFY pgrst, 'reload schema';
