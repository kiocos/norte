import { readFile, readdir } from "node:fs/promises";
import pg from "pg";
const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error("Set DATABASE_URL in .env.local or the environment.");
const client = new pg.Client({
  connectionString,
  ssl:
    process.env.DATABASE_SSL === "true"
      ? { rejectUnauthorized: true }
      : undefined,
});
await client.connect();
try {
  for (const migration of (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await client.query(
      await readFile("supabase/migrations/" + migration, "utf8"),
    );
  const data = JSON.parse(
    await readFile("data/processed/catalog.json", "utf8"),
  );
  await client.query("BEGIN");
  await client.query(`INSERT INTO data_sources (id,name,url,period,methodology) VALUES
 ('cbo','CBO · Ministério do Trabalho e Emprego','https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/cbo/servicos/downloads/downloads','Consulta em 10/10/2026','Ocupações, sinônimos e atividades oficiais. Não equivale a lista de profissões regulamentadas.'),
 ('rais','RAIS · agregado por Futuro das Carreiras','https://futurodascarreiras.com/indicadores/salarios/','2025','Remuneração mensal média no ano por vínculo formal. Mediana e quartis; valores nominais. Suprimimos amostras menores que 30. Agregado de terceiros não reprocessado a partir dos microdados.'),
 ('caged','Novo CAGED · agregado por Futuro das Carreiras','https://futurodascarreiras.com/indicadores/salarios/','09/2025 a 08/2026','Salário de admissão, admissões e desligamentos. Agregado de terceiros; não representa todas as formas de trabalho.')
 ON CONFLICT(id) DO UPDATE SET name=excluded.name,url=excluded.url,period=excluded.period,methodology=excluded.methodology`);
  for (const [index, a] of data.areas.entries())
    await client.query(
      "INSERT INTO areas VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET title=excluded.title,color=excluded.color,icon=excluded.icon,description=excluded.description,position=excluded.position",
      [a.id, a.title, a.color, a.icon, a.description, index],
    );
  await client.query(
    `INSERT INTO families(code,title,preparation,preparation_summary,preparation_source,preparation_snapshot)
     SELECT code,title,preparation,"preparationSummary","preparationSource","preparationSnapshot"
     FROM jsonb_to_recordset($1::jsonb) AS x(code text,title text,preparation text,"preparationSummary" text,"preparationSource" text,"preparationSnapshot" text)
     ON CONFLICT(code) DO UPDATE SET title=excluded.title,preparation=excluded.preparation,preparation_summary=excluded.preparation_summary,preparation_source=excluded.preparation_source,preparation_snapshot=excluded.preparation_snapshot`,
    [JSON.stringify(data.families)],
  );
  for (let i = 0; i < data.occupations.length; i += 100) {
    const batch = data.occupations.slice(i, i + 100);
    await client.query(
      `INSERT INTO occupations(code,title,area_id,family_code,activities,riasec,remote_potential,remote_reason,kind,source_url,work_modes,description)
   SELECT code,title,area,family,activities,riasec,remote,"remoteReason",kind,"sourceUrl","workModes",description FROM jsonb_to_recordset($1::jsonb) AS x(code text,title text,area text,family text,activities jsonb,riasec jsonb,remote text,"remoteReason" text,kind text,"sourceUrl" text,"workModes" jsonb,description text)
   ON CONFLICT(code) DO UPDATE SET title=excluded.title,area_id=excluded.area_id,family_code=excluded.family_code,activities=excluded.activities,riasec=excluded.riasec,remote_potential=excluded.remote_potential,remote_reason=excluded.remote_reason,kind=excluded.kind,source_url=excluded.source_url,work_modes=excluded.work_modes,description=excluded.description`,
      [JSON.stringify(batch)],
    );
    await client.query(
      "DELETE FROM occupation_aliases WHERE occupation_code = ANY($1::text[])",
      [batch.map((o) => o.code)],
    );
    const aliases = batch.flatMap((o) =>
      o.aliases.map((title) => ({ code: o.code, title })),
    );
    await client.query(
      `INSERT INTO occupation_aliases SELECT code,title FROM jsonb_to_recordset($1::jsonb) AS x(code text,title text) ON CONFLICT DO NOTHING`,
      [JSON.stringify(aliases)],
    );
    await client.query(
      `INSERT INTO salary_observations SELECT code,'rais',salary,"salaryLow","salaryHigh","salaryMean",sample,employment,"salaryStatus" FROM jsonb_to_recordset($1::jsonb) AS x(code text,salary numeric,"salaryLow" numeric,"salaryHigh" numeric,"salaryMean" numeric,sample integer,employment integer,"salaryStatus" text)
   ON CONFLICT(occupation_code,source_id) DO UPDATE SET median=excluded.median,p25=excluded.p25,p75=excluded.p75,mean=excluded.mean,sample_size=excluded.sample_size,employment=excluded.employment,status=excluded.status`,
      [JSON.stringify(batch.filter((o) => o.kind === "cbo"))],
    );
    await client.query(
      `INSERT INTO employment_observations SELECT code,'caged',"admissionSalary",admissions,dismissals,balance FROM jsonb_to_recordset($1::jsonb) AS x(code text,"admissionSalary" numeric,admissions integer,dismissals integer,balance integer)
   ON CONFLICT(occupation_code) DO UPDATE SET admission_salary=excluded.admission_salary,admissions=excluded.admissions,dismissals=excluded.dismissals,balance=excluded.balance`,
      [JSON.stringify(batch.filter((o) => o.kind === "cbo"))],
    );
  }
  await client.query("COMMIT");
  console.log(
    `Seed complete: ${data.occupations.length} occupations, ${data.families.length} families, ${data.areas.length} areas.`,
  );
} catch (e) {
  await client.query("ROLLBACK");
  throw e;
} finally {
  await client.end();
}
