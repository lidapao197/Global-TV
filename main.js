/**
 * 全球影视平台 ALL IN ONE —— Cloudflare Worker（纯静态托管）
 *
 * 前端在浏览器中直接请求 TMDB 官方接口，API Key 仅保存在用户浏览器，
 * 因此本 Worker 只负责把构建时内联的前端资源按路径返回：
 *   /            → index.html
 *   /index.css   → index.css
 *   /index.js    → index.js（浏览器脚本）
 *
 * 前端资源均以 Text 模块在构建时打包，见 wrangler.jsonc 的 rules。
 */

import HTML from "./index.html";
import CSS from "./index.css";
import APP_JS from "./index.js";

/** 前端静态资源（构建时以 Text 模块内联） */
const STATIC_ASSETS = {
  "/": { body: HTML, type: "text/html;charset=UTF-8" },
  "/index.html": { body: HTML, type: "text/html;charset=UTF-8" },
  "/index.css": { body: CSS, type: "text/css;charset=UTF-8" },
  "/index.js": { body: APP_JS, type: "application/javascript;charset=UTF-8" }
};

export default {
  /**
   * @param {Request} request
   */
  async fetch(request) {
    const url = new URL(request.url);
    const asset = STATIC_ASSETS[url.pathname] || STATIC_ASSETS["/"];
    return new Response(asset.body, {
      headers: {
        "content-type": asset.type,
        "cache-control": "no-cache"
      }
    });
  }
};
