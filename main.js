/**
 * 全球影视平台 ALL IN ONE —— Cloudflare Worker
 *
 * 职责：
 *   1. 托管前端静态资源（index.html / index.css / index.js，构建时 Text 内联）
 *   2. GET /api/config —— 告知前端服务端是否已配置 TMDB_API_KEY（只返回布尔值，不下发密钥）
 *   3. /api/3/*       —— TMDB 反向代理；服务端 Key 存在时注入，浏览器接触不到密钥
 *
 * 前端策略：先请求 /api/config，服务端有 Key → 走代理；没有 → 弹窗让用户
 * 在浏览器本地填写 Key（localStorage）并直连 TMDB，本地 Key 不会回传本服务。
 */

import HTML from "./index.html";
import CSS from "./index.css";
import APP_JS from "./index.js";

const TMDB_UPSTREAM = "https://api.themoviedb.org/3";
const API_PREFIX = "/api/3/";
const CONFIG_PATH = "/api/config";
const CACHE_TTL = 3600;

/** 前端静态资源（构建时以 Text 模块内联） */
const STATIC_ASSETS = {
  "/": { body: HTML, type: "text/html;charset=UTF-8" },
  "/index.html": { body: HTML, type: "text/html;charset=UTF-8" },
  "/index.css": { body: CSS, type: "text/css;charset=UTF-8" },
  "/index.js": { body: APP_JS, type: "application/javascript;charset=UTF-8" }
};

function json(data, status = 200){
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json;charset=UTF-8" }
  });
}

export default {
  /**
   * @param {Request} request
   * @param {{ TMDB_API_KEY?: string }} env
   * @param {ExecutionContext} ctx
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname, search } = url;

    // 服务端密钥配置探测：只暴露布尔状态
    if(pathname === CONFIG_PATH){
      return json({ serverKeyConfigured: Boolean(env?.TMDB_API_KEY) });
    }

    // TMDB 反向代理：仅使用服务端 Key 注入
    if(pathname.startsWith(API_PREFIX)){
      const apiKey = env?.TMDB_API_KEY;
      if(!apiKey){
        return json(
          { code: "NO_SERVER_KEY", status_message: "服务端未配置 TMDB_API_KEY" },
          500
        );
      }
      const target = new URL(
        TMDB_UPSTREAM + pathname.slice(API_PREFIX.length - 1) + search
      );
      target.searchParams.set("api_key", apiKey);

      const cache = caches.default;
      const cached = await cache.match(request);
      if(cached) return cached;

      const upstream = await fetch(new Request(target, {
        headers: { accept: "application/json" }
      }));

      if(!upstream.ok){
        return new Response(upstream.body, {
          status: upstream.status,
          headers: { "content-type": "application/json;charset=UTF-8" }
        });
      }
      const resp = new Response(upstream.body, upstream);
      resp.headers.set("cache-control", `public, max-age=${CACHE_TTL}`);
      ctx.waitUntil(cache.put(request, resp.clone()));
      return resp;
    }

    // 静态资源
    const asset = STATIC_ASSETS[pathname] || STATIC_ASSETS["/"];
    return new Response(asset.body, {
      headers: { "content-type": asset.type, "cache-control": "no-cache" }
    });
  }
};
