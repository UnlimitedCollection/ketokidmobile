ALTER TABLE kids ADD COLUMN IF NOT EXISTS diet_type varchar(30) NOT NULL DEFAULT 'classic';
ALTER TABLE kids ADD COLUMN IF NOT EXISTS diet_sub_category varchar(20);
ALTER TABLE medical_settings ADD COLUMN IF NOT EXISTS diet_type varchar(30) NOT NULL DEFAULT 'classic';
ALTER TABLE medical_settings ADD COLUMN IF NOT EXISTS diet_sub_category varchar(20);

UPDATE kids SET diet_type = CASE
  WHEN phase = 1 THEN 'classic'
  WHEN phase = 2 THEN 'mad'
  WHEN phase = 3 THEN 'mct'
  WHEN phase = 4 THEN 'lowgi'
  ELSE 'classic'
END WHERE phase IS NOT NULL;

UPDATE medical_settings SET diet_type = CASE
  WHEN phase = 1 THEN 'classic'
  WHEN phase = 2 THEN 'mad'
  WHEN phase = 3 THEN 'mct'
  WHEN phase = 4 THEN 'lowgi'
  ELSE 'classic'
END WHERE phase IS NOT NULL;

ALTER TABLE kids DROP COLUMN IF EXISTS phase;
ALTER TABLE medical_settings DROP COLUMN IF EXISTS phase;
