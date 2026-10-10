import { getDetail } from "@/lib/db";
export const runtime = "nodejs";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  if (!/^(\d{6}|mei-[a-z0-9-]+|path-[a-z0-9-]+)$/.test(code))
    return Response.json({ error: "Código inválido" }, { status: 400 });
  try {
    const data = await getDetail(code);
    return data
      ? Response.json(data)
      : Response.json({ error: "Ocupação não encontrada" }, { status: 404 });
  } catch (e) {
    console.error("Detail query failed", e instanceof Error ? e.message : e);
    return Response.json(
      { error: "Não foi possível carregar esta opção." },
      { status: 503 },
    );
  }
}
