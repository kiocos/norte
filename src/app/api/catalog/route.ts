import { getCatalog } from "@/lib/db";
export const runtime = "nodejs";
export async function GET() {
  try {
    return Response.json(await getCatalog(), {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (e) {
    console.error("Catalog query failed", e instanceof Error ? e.message : e);
    return Response.json(
      {
        error:
          "Não foi possível carregar o catálogo. Verifique a conexão com o banco.",
      },
      { status: 503 },
    );
  }
}
