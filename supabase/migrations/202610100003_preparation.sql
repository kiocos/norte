-- Historical family-level description, not a current legal entry requirement.
ALTER TABLE families ADD COLUMN IF NOT EXISTS preparation text NOT NULL DEFAULT 'nao_informada'
 CHECK (preparation IN ('fundamental','medio','tecnica','superior','qualificacao','variavel','nao_informada'));
ALTER TABLE families ADD COLUMN IF NOT EXISTS preparation_summary text;
ALTER TABLE families ADD COLUMN IF NOT EXISTS preparation_source text;
ALTER TABLE families ADD COLUMN IF NOT EXISTS preparation_snapshot text;
