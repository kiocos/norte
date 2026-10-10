import { health } from "@/lib/db";
export const runtime = "nodejs";
export async function GET() {
  try {
    return Response.json({
      status: "ok",
      database: "postgresql",
      ...(await health()),
    });
  } catch {
    return Response.json({ status: "error" }, { status: 503 });
  }
}
