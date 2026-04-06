CREATE TABLE IF NOT EXISTS side_effects (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(200) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kid_side_effects (
  id              SERIAL PRIMARY KEY,
  kid_id          INTEGER NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
  side_effect_id  INTEGER REFERENCES side_effects(id) ON DELETE CASCADE,
  custom_name     VARCHAR(200),
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
