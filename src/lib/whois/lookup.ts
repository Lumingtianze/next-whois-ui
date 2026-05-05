import { WhoisResult, WhoisAnalyzeResult } from "@/lib/whois/types";
import { getJsonRedisValue, setJsonRedisValue } from "@/lib/server/redis";
import { convertRdapToWhoisResult } from "@/lib/whois/rdap_client";
import { extractDomain } from "@/lib/utils";

const LOOKUP_TIMEOUT = 15_000;

// 自定义的轻量级判断函数
const isIP = (q: string) =>
  /^(\d{1,3}\.){3}\d{1,3}$/.test(q.replace(/\/\d+$/, "")) || q.includes(":");
const isASN = (q: string) => /^AS\d+$/i.test(q) || /^\d+$/.test(q);

async function fetchRdapDirect(query: string): Promise<any> {
  const queryClean = query.trim();
  let url = "";

  if (isIP(queryClean)) {
    url = `https://rdap.db.ripe.net/ip/${queryClean.replace(/\/\d+$/, "")}`;
  } else if (isASN(queryClean)) {
    const asNum = queryClean.replace(/AS/i, "");
    url = `https://rdap.org/autnum/${asNum}`;
  } else {
    // 使用 extractDomain 确保查询的是主域名而非 www 或带协议的 URL
    const domainToQuery = extractDomain(queryClean) || queryClean;
    url = `https://rdap.org/domain/${domainToQuery.toLowerCase()}`;
  }

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
    },
    // 使用 Web 标准的超时控制
    signal: AbortSignal.timeout(LOOKUP_TIMEOUT),
  });

  if (response.status === 404) {
    throw new Error("No RDAP data found for this query");
  }
  
  if (!response.ok) {
    throw new Error(`RDAP Server returned status: ${response.status}`);
  }

  return response.json();
}

export async function lookupWhoisWithCache(
  domain: string,
): Promise<WhoisResult> {
  const key = `whois:v2:${domain}`;

  // 1. 缓存读取
  try {
    const cached = await getJsonRedisValue<WhoisResult>(key);
    if (cached) {
      return { ...cached, time: 0, cached: true };
    }
  } catch (e) {
    console.error("Redis Read Error:", e);
  }

  const startTime = performance.now();
  const elapsed = () => (performance.now() - startTime) / 1000;

  try {
    // 2. 执行 RDAP 查询
    const rdapData = await fetchRdapDirect(domain);
    
    // 3. 转换为标准结果（convertRdapToWhoisResult 内部已包含 applyParams）
    const result: WhoisAnalyzeResult = await convertRdapToWhoisResult(
      rdapData,
      domain,
    );

    const finalResponse: WhoisResult = {
      time: elapsed(),
      status: true,
      cached: false,
      source: "rdap",
      result,
    };

    // 4. 写入缓存
    try {
      await setJsonRedisValue(key, finalResponse);
    } catch (e) {}

    return finalResponse;
  } catch (err: any) {
    const errorMsg = err.message || "Unknown error";
    const isTldUnsupported = /not supported|404/i.test(errorMsg);

    return {
      time: elapsed(),
      status: false,
      cached: false,
      source: "rdap",
      error: isTldUnsupported
        ? "WHOIS/RDAP not available for this TLD or object"
        : errorMsg,
    };
  }
}
