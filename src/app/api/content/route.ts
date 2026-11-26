import { SiteContentSchema } from "@/content/schema";
import { hasUnsafeKeys } from "@/content/safe-keys";
import { getSiteContent } from "@/server/content/repository";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function error(status: number, code: string): Response {
  return Response.json({ error: code }, { status, headers: NO_STORE });
}

export async function GET(request: Request): Promise<Response> {
  const query: Record<string, string> = {};
  for (const [k, v] of new URL(request.url).searchParams) query[k] = v;
  // Operator-style keys and any parameter at all are rejected before the data layer.
  if (hasUnsafeKeys(query) || Object.keys(query).length > 0) {
    return error(400, "invalid_query");
  }

  const { content, source } = await getSiteContent();
  const parsed = SiteContentSchema.safeParse(content);
  if (!parsed.success) {
    console.error("content API: content failed schema validation");
    return error(500, "content_invalid");
  }
  return Response.json(
    { content: parsed.data, source },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
