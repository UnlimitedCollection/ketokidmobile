DO $$
DECLARE
  r RECORD;
  new_code TEXT;
BEGIN
  FOR r IN SELECT id, kid_code FROM kids WHERE kid_code LIKE 'KID-%' OR kid_code LIKE 'KKC-%' LOOP
    LOOP
      new_code := 'PHN' || LPAD((FLOOR(RANDOM() * 90000) + 10000)::TEXT, 5, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM kids WHERE kid_code = new_code);
    END LOOP;
    UPDATE kids SET kid_code = new_code WHERE id = r.id;
    RAISE NOTICE 'Migrated kid %: % -> %', r.id, r.kid_code, new_code;
  END LOOP;
END;
$$;
