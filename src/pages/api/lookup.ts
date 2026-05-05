import { lookupWhoisWithCache } from "@/lib/whois/lookup";

export const config = {
  runtime: 'edge',
};

// 使用标准的 Web Request/Response 替换 Next.js 特有 API 对象
export default async function handler(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('query') || searchParams.get('q');

  if (!query || query.length === 0) {
    return new Response(
      JSON.stringify({ time: -1, status: false, error: "Query is required" }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { time, status, result, error, cached, source } =
    await lookupWhoisWithCache(query);

  if (!status) {
    return new Response(
      JSON.stringify({ time, status, error }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 返回处理后的 JSON 数据
  return new Response(
    JSON.stringify({ time, status, result, cached, source }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400'
      }
    }
  );
}