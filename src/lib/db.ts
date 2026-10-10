import "server-only";
import { Pool } from "pg";
import { Catalog, Detail } from "./types";
const globalDb = globalThis as unknown as { nortePool?: Pool };
function pool() {
  if (!process.env.DATABASE_URL)
    throw new Error(
      "DATABASE_URL não configurada. Execute npm run db:local e npm run db:setup.",
    );
  return (globalDb.nortePool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 4,
    idleTimeoutMillis: 20000,
    connectionTimeoutMillis: 8000,
    ssl:
      process.env.DATABASE_SSL === "true"
        ? { rejectUnauthorized: true }
        : undefined,
  }));
}
const columns = `o.code,o.title,o.area_id AS area,o.family_code AS family,
 COALESCE(a.aliases,'[]'::json) AS aliases,o.riasec,o.remote_potential AS remote,
 s.median::float AS salary,s.p25::float AS "salaryLow",s.p75::float AS "salaryHigh",
 COALESCE(s.sample_size,0) AS sample,COALESCE(s.employment,0) AS employment,
 o.kind,o.source_url AS "sourceUrl",o.work_modes AS "workModes",
 COALESCE(f.preparation,'nao_informada') AS preparation`;
const joins = `LEFT JOIN salary_observations s ON s.occupation_code=o.code AND s.source_id='rais'
 LEFT JOIN (SELECT occupation_code,json_agg(title ORDER BY title) AS aliases FROM occupation_aliases GROUP BY occupation_code) a ON a.occupation_code=o.code
 LEFT JOIN families f ON f.code=o.family_code`;
export async function getCatalog(): Promise<Catalog> {
  const [areas, occupations] = await Promise.all([
    pool().query(
      "SELECT id,title,color,icon,description FROM areas ORDER BY position",
    ),
    pool().query(
      `SELECT ${columns} FROM occupations o ${joins} ORDER BY o.title`,
    ),
  ]);
  return {
    areas: areas.rows,
    occupations: occupations.rows,
    updatedAt: "2026-10-10",
  };
}
export async function getDetail(code: string): Promise<Detail | null> {
  const { rows } = await pool().query(
    `SELECT ${columns},o.activities,o.remote_reason AS "remoteReason",o.description,
 f.title AS "familyTitle",s.mean::float AS "salaryMean",s.status AS "salaryStatus",
 e.admission_salary::float AS "admissionSalary",e.admissions,e.dismissals,e.balance,
 f.preparation_summary AS "preparationSummary",f.preparation_source AS "preparationSource",f.preparation_snapshot AS "preparationSnapshot"
 FROM occupations o ${joins}
 LEFT JOIN employment_observations e ON e.occupation_code=o.code WHERE o.code=$1`,
    [code],
  );
  return rows[0] ?? null;
}
export async function health() {
  const r = await pool().query(
    "SELECT count(*)::integer AS total FROM occupations",
  );
  return r.rows[0];
}
