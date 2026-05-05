import { WhoisAnalyzeResult, DomainStatusProps } from "./types";
import { extractDomain } from "@/lib/utils";
import { applyParams } from "./common_parser";

export interface RdapResponse {
  handle?: string;
  ldhName?: string;
  unicodeName?: string;
  entities?: Array<{
    handle?: string;
    roles?: string[];
    vcardArray?: any[];
    publicIds?: Array<{ type: string; identifier: string }>;
  }>;
  nameservers?: Array<{ ldhName?: string; unicodeName?: string }>;
  status?: string[];
  events?: Array<{ eventAction: string; eventDate: string }>;
  secureDNS?: {
    delegationSigned?: boolean;
    dsData?: Array<{
      keyTag?: number;
      algorithm?: number;
      digest?: string;
      digestType?: number;
    }>;
  };
  notices?: Array<{
    title?: string;
    description?: string[];
    links?: Array<{ href: string; rel?: string; type?: string }>;
  }>;
  startAddress?: string;
  endAddress?: string;
  ipVersion?: string;
  name?: string;
  type?: string;
  country?: string;
  parentHandle?: string;
  startAutnum?: string | number;
  endAutnum?: string | number;
}

function isIPAddress(query: string): boolean {
  const bare = query.replace(/\/\d{1,3}/, "");
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}/;
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){1,7}[0-9a-fA-F]{0,4}$/;
  return ipv4Regex.test(bare) || ipv6Regex.test(bare);
}

function isASNumber(query: string): boolean {
  return /^AS\d+/i.test(query) || /^\d+/.test(query);
}

// 使用 Web 标准的 fetch 代替 node-rdap
export async function lookupRdap(query: string): Promise<any> {
  const cleanQuery = query.trim().toLowerCase();

  if (isIPAddress(cleanQuery)) {
    const ipToQuery = cleanQuery.replace(/\/\d+$/, "");

    // 直接请求官方 RIR RDAP 数据
    const response = await fetch(`https://rdap.db.ripe.net/ip/${ipToQuery}`, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`RDAP Server error: ${response.status}`);
    }

    return await response.json();
  } else if (isASNumber(cleanQuery)) {
    const asNumber = cleanQuery.replace(/^as/i, "");
    const response = await fetch(`https://rdap.org/autnum/${asNumber}`, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
      },
    });
    if (!response.ok) throw new Error(`RDAP Server error: ${response.status}`);
    return await response.json();
  } else {
    const domainToQuery = extractDomain(cleanQuery) || cleanQuery;
    const response = await fetch(`https://rdap.org/domain/${domainToQuery}`, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
      },
    });
    if (!response.ok) throw new Error(`RDAP Server error: ${response.status}`);
    return await response.json();
  }
}

// 增强 VCARD 提取逻辑，支持读取 adr 的 label 属性和解析复杂字段
function extractVcardField(vcardFields: any[], fieldName: string): string {
  if (!vcardFields || !Array.isArray(vcardFields)) return "Unknown";

  for (const entry of vcardFields) {
    if (Array.isArray(entry) && entry[0] === fieldName) {
      // 优先获取参数配置中的 label 标签（例如地址字段中的 label）
      if (entry[1] && typeof entry[1] === "object" && entry[1].label) {
        return String(entry[1].label).replace(/\n/g, ", ");
      }

      let val = entry[3];
      if (Array.isArray(val)) {
        const filtered = val.filter((v) => v !== "");
        if (filtered.length > 0) val = filtered.join(", ");
      }

      // 如果是电话或邮箱，移除协议前缀并清洗格式
      if (val && typeof val === "string") {
        if (fieldName === "tel") {
        // 移除 tel: 前缀，并将所有点号 . 替换为空格
          val = val.replace(/^tel:/i, "").replace(/\./g, " ");
        } else if (fieldName === "email") {
          val = val.replace(/^mailto:/i, "");
        }
      }


      return val ? String(val) : "Unknown";
    }
  }
  return "Unknown";
}

// 递归寻找嵌套实体。RDAP 会把子级 abuse/tech 联系方式挂在主级之下
function findAllEntities(entities: any[]): any[] {
  if (!entities || !Array.isArray(entities)) return [];
  let result: any[] = [];
  for (const entity of entities) {
    result.push(entity);
    if (entity.entities) {
      result.push(...findAllEntities(entity.entities));
    }
  }
  return result;
}

// 强化实体解析器：支持角色优先级回退（Registrant -> Admin -> Tech -> Abuse）
function parseRdapEntity(
  entities: any[],
  rootCountry?: string,
): {
  registrar: string;
  registrarURL: string;
  ianaId: string;
  registrantOrganization: string;
  registrantCountry: string;
  registrantProvince: string;
  registrantPhone: string;
  registrantEmail: string;
} {
  let registrar = "Unknown";
  let registrarURL = "Unknown";
  let ianaId = "N/A";

  let registrantOrganization = "Unknown";
  let registrantCountry = rootCountry || "Unknown";
  let registrantProvince = "Unknown";
  let registrantPhone = "Unknown";
  let registrantEmail = "Unknown";

  const flatEntities = findAllEntities(entities);

  // 第一步：提取 Registrar 属性
  for (const entity of flatEntities) {
    const roles = entity.roles || [];
    const vcard = entity.vcardArray?.[1] || [];

    if (roles.includes("registrar")) {
      const fnVal = extractVcardField(vcard, "fn");
      const orgVal = extractVcardField(vcard, "org");
      registrar =
        fnVal !== "Unknown" ? fnVal : orgVal !== "Unknown" ? orgVal : registrar;

      if (entity.publicIds) {
        const ianaEntry = entity.publicIds.find(
          (pub: any) => pub.type === "IANA Registrar ID",
        );
        if (ianaEntry) {
          ianaId = String(ianaEntry.identifier);
        }
      }
    }
  }

  // 第二步：通过优先级角色回退，层层筛选联系邮箱/电话/地址
  const rolesPriority = ["registrant", "administrative", "technical", "abuse"];
  for (const role of rolesPriority) {
    for (const entity of flatEntities) {
      const roles = entity.roles || [];
      if (roles.includes(role)) {
        const vcard = entity.vcardArray?.[1] || [];

        const orgVal = extractVcardField(vcard, "org");
        const fnVal = extractVcardField(vcard, "fn");
        const emailVal = extractVcardField(vcard, "email");
        const telVal = extractVcardField(vcard, "tel");
        const regionVal = extractVcardField(vcard, "region");
        const countryVal = extractVcardField(vcard, "country-name");

        if (registrantOrganization === "Unknown") {
          registrantOrganization =
            orgVal !== "Unknown" ? orgVal : fnVal !== "Unknown" ? fnVal : "Unknown";
        }
        if (registrantEmail === "Unknown") {
          registrantEmail = emailVal !== "Unknown" ? emailVal : "Unknown";
        }
        if (registrantPhone === "Unknown") {
          registrantPhone = telVal !== "Unknown" ? telVal : "Unknown";
        }
        if (registrantProvince === "Unknown") {
          registrantProvince = regionVal !== "Unknown" ? regionVal : "Unknown";
        }
        if (registrantCountry === "Unknown") {
          registrantCountry =
            countryVal !== "Unknown"
              ? countryVal
              : rootCountry || "Unknown";
        }
      }
    }
  }

  // 第三步：尝试从注册商的 links 信息中提取官方 URL
  for (const entity of flatEntities) {
    if (entity.roles?.includes("registrar") && entity.links) {
      const aboutLink = entity.links.find(
        (l: any) => l.rel === "about" || l.rel === "self",
      );
      if (aboutLink) {
        registrarURL = aboutLink.href;
      }
    }
  }

  return {
    registrar,
    registrarURL,
    ianaId,
    registrantOrganization,
    registrantCountry,
    registrantProvince,
    registrantPhone,
    registrantEmail,
  };
}

export async function convertRdapToWhoisResult(
  rdapData: any,
  originalQuery: string,
): Promise<WhoisAnalyzeResult> {
  const entities = rdapData.entities || [];
  const entityData = parseRdapEntity(entities, rdapData.country);

  const events = rdapData.events || [];
  const creationEvent = events.find((e: any) => e.eventAction === "registration");
  const updateEvent = events.find((e: any) => e.eventAction === "last changed");
  const expirationEvent = events.find((e: any) => e.eventAction === "expiration");

  const creationDate = creationEvent?.eventDate || "Unknown";
  const updatedDate = updateEvent?.eventDate || "Unknown";
  const expirationDate = expirationEvent?.eventDate || "Unknown";

  const domainAge =
    creationDate !== "Unknown"
      ? Math.floor(
          (Date.now() - new Date(creationDate).getTime()) / (1000 * 60 * 60 * 24),
        )
      : null;

  const remainingDays =
    expirationDate !== "Unknown"
      ? Math.floor(
          (new Date(expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        )
      : null;

  const status: DomainStatusProps[] = (rdapData.status || []).map((s: any) => ({
    status: s,
    url: "https://icann.org/epp",
  }));

  const nameServers = (rdapData.nameservers || []).map((ns: any) =>
    (ns.ldhName || ns.unicodeName || "Unknown").split(/\s+/)[0],
  );

  // 智能匹配 CIDR
  let cidr = "Unknown";
  if (
    rdapData.cidr0_cidrs &&
    Array.isArray(rdapData.cidr0_cidrs) &&
    rdapData.cidr0_cidrs.length > 0
  ) {
    const firstCidr = rdapData.cidr0_cidrs[0];
    if (firstCidr.v4prefix && firstCidr.length !== undefined) {
      cidr = `${firstCidr.v4prefix}/${firstCidr.length}`;
    } else if (firstCidr.v6prefix && firstCidr.length !== undefined) {
      cidr = `${firstCidr.v6prefix}/${firstCidr.length}`;
    }
  } else if (rdapData.startAddress && rdapData.endAddress) {
    cidr = `${rdapData.startAddress}-${rdapData.endAddress}`;
  }

  // 使用 RIR 原生 ASN 数据
  let originAS = "Unknown";
  if (rdapData.startAutnum) {
    originAS = `AS${rdapData.startAutnum}`;
  }

  const result = {
    domain: rdapData.ldhName || rdapData.unicodeName || originalQuery,
    registrar: entityData.registrar,
    registrarURL: entityData.registrarURL,
    ianaId: entityData.ianaId,
    whoisServer: "https://rdap.org",
    updatedDate,
    creationDate,
    expirationDate,
    status,
    nameServers,
    registrantOrganization: entityData.registrantOrganization,
    registrantProvince: entityData.registrantProvince,
    registrantCountry: entityData.registrantCountry,
    registrantPhone: entityData.registrantPhone,
    registrantEmail: entityData.registrantEmail,
    dnssec: rdapData.secureDNS?.delegationSigned ? "signedDelegation" : "unsigned",
    rawWhoisContent: "",
    rawRdapContent: JSON.stringify(rdapData, null, 2),
    domainAge,
    remainingDays,
    registerPrice: null,
    renewPrice: null,
    transferPrice: null,
    mozDomainAuthority: 0,
    mozPageAuthority: 0,
    mozSpamScore: 0,
    cidr,
    inetNum:
      rdapData.startAddress && rdapData.endAddress
        ? `${rdapData.startAddress} - ${rdapData.endAddress}`
        : rdapData.startAddress || "Unknown",
    inet6Num:
      rdapData.ipVersion === "v6"
        ? rdapData.startAddress && rdapData.endAddress
          ? `${rdapData.startAddress} - ${rdapData.endAddress}`
          : rdapData.startAddress || "Unknown"
        : "Unknown",
    netRange:
      rdapData.startAddress && rdapData.endAddress
        ? `${rdapData.startAddress} - ${rdapData.endAddress}`
        : "Unknown",
    netName: rdapData.name || "Unknown",
    netType: rdapData.type || "Unknown",
    originAS,
  };

  return await applyParams(result);
}
