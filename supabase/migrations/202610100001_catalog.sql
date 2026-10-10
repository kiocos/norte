BEGIN;
CREATE TABLE IF NOT EXISTS public.data_sources (
 id text PRIMARY KEY, name text NOT NULL, url text NOT NULL,
 period text NOT NULL, methodology text NOT NULL
);
CREATE TABLE IF NOT EXISTS public.areas (
 id text PRIMARY KEY, title text NOT NULL, color text NOT NULL,
 icon text NOT NULL, description text NOT NULL, position integer NOT NULL
);
CREATE TABLE IF NOT EXISTS public.families (
 code text PRIMARY KEY CHECK (code ~ '^[0-9]{4}$'), title text NOT NULL
);
CREATE TABLE IF NOT EXISTS public.occupations (
 code text PRIMARY KEY CHECK (code ~ '^[0-9]{6}$'), title text NOT NULL,
 area_id text NOT NULL REFERENCES public.areas(id),
 family_code text NOT NULL REFERENCES public.families(code),
 activities jsonb NOT NULL DEFAULT '[]'::jsonb,
 riasec jsonb NOT NULL,
 remote_potential text NOT NULL CHECK (remote_potential IN ('alto','parcial','presencial','nao_avaliado')),
 remote_reason text NOT NULL,
 classification_version text NOT NULL DEFAULT 'editorial-cbo-v1'
);
CREATE TABLE IF NOT EXISTS public.occupation_aliases (
 occupation_code text NOT NULL REFERENCES public.occupations(code) ON DELETE CASCADE,
 title text NOT NULL, PRIMARY KEY(occupation_code,title)
);
CREATE TABLE IF NOT EXISTS public.salary_observations (
 occupation_code text NOT NULL REFERENCES public.occupations(code) ON DELETE CASCADE,
 source_id text NOT NULL REFERENCES public.data_sources(id),
 median numeric, p25 numeric, p75 numeric, mean numeric,
 sample_size integer NOT NULL CHECK(sample_size>=0), employment integer NOT NULL CHECK(employment>=0),
 status text NOT NULL CHECK(status IN ('available','small_sample','unavailable')),
 PRIMARY KEY(occupation_code,source_id),
 CHECK (median IS NULL OR (median>0 AND p25<=median AND median<=p75))
);
CREATE TABLE IF NOT EXISTS public.employment_observations (
 occupation_code text PRIMARY KEY REFERENCES public.occupations(code) ON DELETE CASCADE,
 source_id text NOT NULL REFERENCES public.data_sources(id),
 admission_salary numeric, admissions integer NOT NULL,
 dismissals integer NOT NULL, balance integer NOT NULL,
 CHECK(balance=admissions-dismissals)
);
CREATE INDEX IF NOT EXISTS occupations_area_idx ON public.occupations(area_id);
CREATE INDEX IF NOT EXISTS occupations_family_idx ON public.occupations(family_code);
CREATE INDEX IF NOT EXISTS salary_median_idx ON public.salary_observations(median);
-- Public datasets are read-only through Supabase's Data API. No anonymous writes.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['data_sources','areas','families','occupations','occupation_aliases','salary_observations','employment_observations'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname='public_catalog_read') THEN
   EXECUTE format('CREATE POLICY public_catalog_read ON public.%I FOR SELECT USING (true)',t);
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
   EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated',t);
   EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated',t);
  END IF;
 END LOOP;
END $$;
COMMIT;
