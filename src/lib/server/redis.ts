import { Redis } from "@upstash/redis";

export const REDIS_CACHE_TTL = parseInt(process.env.REDIS_CACHE_TTL || "3600");

let redisInstance: Redis | null | undefined = undefined;

function getRedisClient(): Redis | null {
  // 如果已经初始化过，直接返回
  if (redisInstance !== undefined) return redisInstance;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    try {
      // 只有在函数被调用时（即请求处理阶段）才创建实例
      redisInstance = new Redis({
        url: url,
        token: token,
      });
      return redisInstance;
    } catch (error) {
      console.error("Failed to connect to Upstash Redis:", error);
      redisInstance = null;
    }
  } else {
    // 未配置环境变量时，标记为 null 以免重复检查
    redisInstance = null;
  }
  
  return null;
}

export async function getRedisValue(key: string): Promise<string | null> {
  const client = getRedisClient();
  if (client) {
    try {
      const res = await client.get<string>(key);
      if (res) {
        console.info(`Redis cache hit: ${key}`);
        return typeof res === 'string' ? res : JSON.stringify(res);
      }
    } catch (e) {
      console.error("Redis get error:", e);
    }
  }
  return null;
}

export async function setRedisValue(
  key: string,
  value: string,
): Promise<boolean> {
  const client = getRedisClient();
  if (client) {
    try {
      const options = REDIS_CACHE_TTL > 0 ? { ex: REDIS_CACHE_TTL } : {};
      await client.set(key, value, options);
      return true;
    } catch (e) {
      console.error("Redis set error:", e);
    }
  }
  return false;
}

export async function getJsonRedisValue<T>(key: string): Promise<T | null> {
  const client = getRedisClient();
  if (client) {
    try {
      // Upstash 客户端会自动处理 JSON 反序列化
      const res = await client.get<T>(key);
      return res || null;
    } catch (error) {
      console.error("Failed to parse JSON from Redis:", error);
    }
  }
  return null;
}

export async function setJsonRedisValue<T>(
  key: string,
  value: T,
): Promise<boolean> {
  const client = getRedisClient();
  if (client) {
    try {
      const options = REDIS_CACHE_TTL > 0 ? { ex: REDIS_CACHE_TTL } : {};
      await client.set(key, value, options);
      return true;
    } catch (error) {
      console.error("Failed to stringify JSON for Redis:", error);
    }
  }
  return false;
}