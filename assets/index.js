/* =========================================================
 * 全球电视台与流媒体宇宙 (Web 版)
 * 逻辑与 allinone.js 完全对齐：PLATFORM_MAP / GENRE_MAP /
 * discover 请求参数（网络ID、发行商ID、地区、类型、排序）
 * ========================================================= */

// ---------- 1. 平台配置（与 allinone.js 的 PLATFORM_MAP / enumOptions 一致） ----------
const PLATFORMS = [
  {v:"all",      t:"🌟 全球综合热播"},
  {v:"netflix",  t:"🔴 Netflix"},
  {v:"hbo",      t:"🟣 HBO"},
  {v:"disney",   t:"🔵 Disney+"},
  {v:"apple",    t:"🍏 Apple TV+"},
  {v:"amazon",   t:"📦 Amazon Prime"},
  {v:"tencent",  t:"🐧 腾讯视频"},
  {v:"iqiyi",    t:"🥝 爱奇艺"},
  {v:"youku",    t:"👖 优酷"},
  {v:"mango",    t:"🥭 芒果TV"},
  {v:"bilibili", t:"📺 BiliBili"},
  {v:"hunan",    t:"📡 湖南卫视"},
  {v:"zhejiang", t:"📡 浙江卫视"},
  {v:"dragon",   t:"📡 东方卫视"},
  {v:"cctv8",    t:"📡 CCTV-8"},
  {v:"viutv",    t:"🇭🇰 ViuTV"},
  {v:"linetv",   t:"🇹🇼 LINE TV"},
  {v:"hami",     t:"🇹🇼 Hami Video"},
  {v:"catchplay",t:"🇹🇼 CATCHPLAY"},
  {v:"tvn",      t:"🇰🇷 tvN"},
  {v:"sbs",      t:"🇰🇷 SBS"},
  {v:"kbs2",     t:"🇰🇷 KBS2"},
  {v:"abc",      t:"🇺🇸 ABC"},
  {v:"natgeo",   t:"🌍 国家地理"}
];

const PLATFORM_MAP = {
  netflix:{network:"213",provider:"8",region:"US",name:"Netflix"},
  hbo:{network:"49|3186",provider:"118",region:"US",name:"HBO"},
  disney:{network:"2739",provider:"337",region:"US",name:"Disney+"},
  apple:{network:"2552",provider:"350",region:"US",name:"Apple TV+"},
  amazon:{network:"1024",provider:"119",region:"US",name:"Amazon"},
  tencent:{network:"2007|3353",provider:"138",region:"CN",name:"腾讯视频"},
  iqiyi:{network:"1330",provider:"238",region:"CN",name:"爱奇艺"},
  youku:{network:"1419",provider:"331",region:"CN",name:"优酷"},
  mango:{network:"1631",provider:"1944",region:"CN",name:"芒果TV"},
  bilibili:{network:"1605",provider:"2280",region:"CN",name:"B站"},
  hunan:{network:"952",provider:null,region:"CN",name:"湖南卫视"},
  zhejiang:{network:"989",provider:null,region:"CN",name:"浙江卫视"},
  dragon:{network:"1056",provider:null,region:"CN",name:"东方卫视"},
  cctv8:{network:"521",provider:null,region:"CN",name:"CCTV-8"},
  viutv:{network:"2146",provider:null,region:"HK",name:"ViuTV"},
  linetv:{network:"1671",provider:null,region:"TW",name:"LINE TV"},
  hami:{network:"4571",provider:null,region:"TW",name:"Hami Video"},
  catchplay:{network:"5002",provider:null,region:"TW",name:"CATCHPLAY"},
  tvn:{network:"866",provider:null,region:"KR",name:"tvN"},
  sbs:{network:"156",provider:null,region:"KR",name:"SBS"},
  kbs2:{network:"342",provider:null,region:"KR",name:"KBS2"},
  abc:{network:"2",provider:null,region:"US",name:"ABC"},
  natgeo:{network:"43",provider:null,region:"US",name:"国家地理"},
  all:{network:null,provider:null,region:null,name:"全球综合"}
};

const GENRE_MAP = {
  28:"动作",12:"冒险",16:"动画",35:"喜剧",80:"犯罪",99:"纪录片",
  18:"剧情",10751:"家庭",14:"奇幻",36:"历史",27:"恐怖",10402:"音乐",
  9648:"悬疑",10749:"爱情",878:"科幻",10770:"电视电影",53:"惊悚",
  10752:"战争",37:"西部",10759:"动作冒险",10764:"真人秀",10767:"脱口秀"
};
const TYPE_LABEL = {tv:"剧集",movie:"电影",anime:"动漫",variety:"综艺/真人秀"};
const SORT_LABEL = {hot:"平台热度榜",new:"最新上线榜",top:"TMDB 高分榜",upcoming:"即将上映"};

/* 双模式请求：
 *  - proxy  ：Cloudflare 已配置服务端 TMDB_API_KEY，浏览器请求同源 /api/3，密钥不下发
 *  - direct ：服务端无 Key（或本地 file:// 打开），用户在弹窗输入 Key，仅存
 *             localStorage，以 api_key 查询参数直连 TMDB，不回传任何服务器
 * 启动时先 GET /api/config 探测服务端状态。 */
const TMDB_ORIGIN = "https://api.themoviedb.org/3";
const PROXY_BASE = "/api/3";
const IMG = "https://image.tmdb.org/t/p";
const API_KEY_STORE = "gtv_tmdb_api_key";

const runtime = { mode: "direct" }; // "proxy" | "direct"
const KEY_ERROR_CODES = ["MISSING_API_KEY", "INVALID_API_KEY", "SERVER_KEY_INVALID"];

function getStoredKey(){
  try{ return localStorage.getItem(API_KEY_STORE) || ""; }catch{ return ""; }
}
function setStoredKey(v){
  try{
    if(v) localStorage.setItem(API_KEY_STORE,v);
    else localStorage.removeItem(API_KEY_STORE);
  }catch{}
}

/* 启动探测：Worker 存在且已配置服务端 Key → proxy；其余情况（无 Key / 本地打开）→ direct */
async function initRuntime(){
  try{
    const res = await fetch("/api/config");
    if(!res.ok) return;
    const cfg = await res.json();
    if(cfg.serverKeyConfigured) runtime.mode = "proxy";
  }catch{ /* file:// 直开或非 Worker 环境：保持 direct */ }
}

/* 构造请求地址：proxy 模式走同源（参数透传，Key 由 Worker 注入），direct 模式直连 TMDB */
function buildApiUrl(path, params = {}){
  const u = runtime.mode === "proxy"
    ? new URL(PROXY_BASE + path, location.origin)
    : new URL(TMDB_ORIGIN + path);
  if(runtime.mode === "direct") u.searchParams.set("api_key", getStoredKey());
  Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,v));
  return u;
}

/* 统一请求封装与错误归一化 */
async function apiFetch(url){
  if(runtime.mode === "direct" && !getStoredKey()){
    const err = new Error("missing api key");
    err.code = "MISSING_API_KEY";
    throw err;
  }
  const res = await fetch(url);
  if(!res.ok){
    let payload = null;
    try{ payload = await res.json(); }catch{}
    const err = new Error(payload?.status_message || "");
    if(runtime.mode === "proxy"){
      if(payload?.code === "NO_SERVER_KEY") err.code = "MISSING_API_KEY";
      else if(res.status === 401) err.code = "SERVER_KEY_INVALID";
      else err.code = "HTTP_" + res.status;
    }else{
      err.code = res.status === 401 ? "INVALID_API_KEY" : "HTTP_" + res.status;
    }
    throw err;
  }
  return res;
}

/* 密钥问题 UI：proxy 正常时隐藏齿轮；direct 模式（或服务端 Key 失效需本地兜底）显示并提醒 */
function applyKeyEntryVisibility(){
  $("#settingsBtn").hidden = runtime.mode === "proxy";
}
function markKeyIssue(){
  $("#settingsBtn").hidden = false;
  $("#settingsBtn").classList.add("attention");
}
function clearKeyIssue(){
  $("#settingsBtn").classList.remove("attention");
  if(runtime.mode === "proxy") $("#settingsBtn").hidden = true;
}

// ---------- 2. 全局状态 ----------
const state = { mode:"browse", platform:"all", mediaType:"tv", sortBy:"new", query:"", page:1, totalPages:1, items:[] };
let requestSeq = 0; // 防止旧请求覆盖新结果

// 单条数据是否电影（搜索结果按 media_type 判断，浏览模式按分类判断）
function itemIsMovie(it){
  return state.mode==="search" ? it.media_type==="movie" : state.mediaType==="movie";
}

// ---------- 3. 工具函数 ----------
function getGenreText(ids, all){
  if(!Array.isArray(ids)) return "";
  const g = ids.map(id=>GENRE_MAP[id]).filter(Boolean);
  return all ? g.join(" / ") : (g.slice(0,2).join(" / ") || "影视");
}
function yearOf(d){ return d ? String(d).slice(0,4) : ""; }
function dateText(d){
  if(!d) return "";
  const [y,m,dd] = String(d).split("-");
  if(!y||!m||!dd) return y||"";
  return `${y}年${parseInt(m)}月${parseInt(dd)}日`;
}
function esc(s){ return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

/* 核心：构建 discover 查询参数（对齐 loadPlatformList） */
function buildQuery(){
  const {platform,mediaType,sortBy,page} = state;
  const today = new Date().toISOString().split("T")[0];
  const isMovie = mediaType === "movie";
  const cfg = PLATFORM_MAP[platform];
  const p = new URLSearchParams({language:"zh-CN",page:String(page)});

  if(platform !== "all"){
    if(isMovie){
      if(!cfg.provider) return {unsupported:true}; // 镜像原逻辑：无发行商ID → 不支持电影分类
      p.set("with_watch_providers",cfg.provider);
      p.set("watch_region",cfg.region||"US");
    }else{
      p.set("with_networks",cfg.network);
    }
  }
  if(mediaType==="anime") p.set("with_genres","16");
  else if(mediaType==="variety") p.set("with_genres","10764|10767");
  else if(mediaType==="tv") p.set("without_genres","16,10764,10767");

  if(sortBy==="hot"){ p.set("sort_by","popularity.desc"); p.set("vote_count.gte","2"); }
  else if(sortBy==="new"){
    p.set("sort_by",isMovie?"primary_release_date.desc":"first_air_date.desc");
    p.set(isMovie?"primary_release_date.lte":"first_air_date.lte",today);
  }
  else if(sortBy==="top"){ p.set("sort_by","vote_average.desc"); p.set("vote_count.gte","30"); }
  else if(sortBy==="upcoming"){
    p.set("sort_by",isMovie?"primary_release_date.asc":"first_air_date.asc");
    p.set(isMovie?"primary_release_date.gte":"first_air_date.gte",today);
  }
  return {params:p};
}

// ---------- 4. 请求 ----------
async function loadList(){
  renderSkeletons();
  updateHead();
  if(state.mode==="search") return runSearch();
  return runDiscover();
}

async function runDiscover(){
  const seq = ++requestSeq;
  const q = buildQuery();
  if(q.unsupported){
    state.items=[]; renderUnsupported(); return;
  }
  const endpoint = state.mediaType==="movie" ? "/discover/movie" : "/discover/tv";
  try{
    const res = await apiFetch(buildApiUrl(endpoint, Object.fromEntries(q.params)));
    const data = await res.json();
    if(seq!==requestSeq) return;
    state.items = data.results||[];
    state.totalPages = Math.min(data.total_pages||1,500);
    clearKeyIssue();
    renderGrid();
    renderPager();
  }catch(e){
    if(seq!==requestSeq) return;
    state.items=[];
    if(KEY_ERROR_CODES.includes(e.code)){
      markKeyIssue();
      renderKeyError(e.code);
    }else{
      renderError("请求失败，请检查网络后重试。");
    }
  }
}

async function runSearch(){
  const seq = ++requestSeq;
  try{
    const res = await apiFetch(buildApiUrl("/search/multi", {
      language:"zh-CN", page:String(state.page), query:state.query, include_adult:"false"
    }));
    const data = await res.json();
    if(seq!==requestSeq) return;
    // multi 搜索含人物条目，只保留电影与剧集
    state.items = (data.results||[]).filter(r=>r.media_type==="movie"||r.media_type==="tv");
    state.totalPages = Math.min(data.total_pages||1,500);
    clearKeyIssue();
    renderGrid();
    renderPager();
  }catch(e){
    if(seq!==requestSeq) return;
    state.items=[];
    if(KEY_ERROR_CODES.includes(e.code)){
      markKeyIssue();
      renderKeyError(e.code);
    }else{
      renderError("搜索失败，请检查网络后重试。");
    }
  }
}

// ---------- 5. 渲染 ----------
const $ = s=>document.querySelector(s);

function renderChips(){
  $("#chips").innerHTML = PLATFORMS.map(p=>
    `<button class="chip${p.v===state.platform?" active":""}" data-v="${p.v}">${p.t}</button>`
  ).join("");
}

function updateHead(){
  if(state.mode==="search"){
    $("#listTitle").innerHTML = `🔍 搜索结果 · <span>${esc(state.query)}</span>`;
    $("#countTxt").textContent = "";
    return;
  }
  const cfg = PLATFORM_MAP[state.platform];
  const cur = PLATFORMS.find(p=>p.v===state.platform);
  $("#listTitle").innerHTML = `${cur.t.split(" ")[0]} <span>${cfg.name}</span> · ${SORT_LABEL[state.sortBy]} · ${TYPE_LABEL[state.mediaType]}`;
  $("#countTxt").textContent = "";
}

function posterUrl(path){ return path ? `${IMG}/w500${path}` : ""; }
function backdropUrl(path){ return path ? `${IMG}/w780${path}` : ""; }

function typeTagOf(item, isMovie){
  let t = isMovie ? "🎬" : "📺";
  if(item.genre_ids?.includes(16)) t="🐰";
  if(item.genre_ids?.includes(10764)||item.genre_ids?.includes(10767)) t="🎤";
  return t;
}

function renderGrid(){
  const grid = $("#grid");
  if(state.items.length===0){
    if(state.mode==="search"){
      grid.innerHTML = `<div class="state"><div class="big">🔍</div><h3>未找到相关影视</h3><p>没有找到与「${esc(state.query)}」相关的电影或剧集，试试更换关键词。</p></div>`;
    }else{
      grid.innerHTML = `<div class="state"><div class="big">🫙</div><h3>无数据</h3><p>在 [${PLATFORM_MAP[state.platform].name}] 暂未找到符合该条件的影视记录，换个榜单或平台试试。</p></div>`;
    }
    $("#countTxt").textContent="";
    return;
  }
  grid.innerHTML = state.items.map((it,i)=>{
    const isMovie = itemIsMovie(it);
    const title = esc(it.title||it.name||"未命名");
    const score = it.vote_average ? it.vote_average.toFixed(1) : null;
    const scoreTxt = score ? `⭐ ${score}` : (state.mode==="browse"&&state.sortBy==="upcoming" ? "⏳ 待映" : "暂无评分");
    const src = posterUrl(it.poster_path);
    const playDate = dateText(it.release_date||it.first_air_date) || (state.mode==="browse"&&state.sortBy==="upcoming" ? "上映日期待定" : "日期待定");
    return `<div class="card" style="--d:${Math.min(i*35,500)}ms" data-id="${it.id}">
      <div class="poster">
        ${src?`<img data-src="${src}" alt="${title}">`:`<div class="poster-fallback">${typeTagOf(it,isMovie)}</div>`}
        <span class="score">${scoreTxt}</span>
      </div>
      <div class="card-meta">
        <div class="card-title">${title}</div>
        <div class="card-sub">📅 ${playDate}</div>
      </div>
    </div>`;
  }).join("");
  $("#countTxt").textContent = `本页 ${state.items.length} 部`;
  lazyObserve();
}

function renderSkeletons(){
  $("#grid").innerHTML = Array.from({length:12},()=>
    `<div class="card skeleton"><div class="poster sk"></div><div class="sk-line sk"></div><div class="sk-line sk short"></div></div>`
  ).join("");
}
function renderUnsupported(){
  $("#grid").innerHTML = `<div class="state"><div class="big">🚫</div><h3>无电影分类</h3><p>[${PLATFORM_MAP[state.platform].name}] 暂不支持电影分类，请切换到剧集或选择其他平台。</p></div>`;
  renderPager();
}
function renderError(msg){
  $("#grid").innerHTML = `<div class="state"><div class="big">📡</div><h3>网络异常</h3><p>${msg}</p><button class="retry" id="retryBtn">重新加载</button></div>`;
}
function renderKeyError(code){
  const map = {
    MISSING_API_KEY: {
      title:"需要配置 TMDB API Key",
      desc:"服务端未配置密钥。点击下方按钮输入你自己的 TMDB API Key，密钥仅保存在当前浏览器，不会上传。",
      btn:"配置 API Key"
    },
    INVALID_API_KEY: {
      title:"API Key 无效",
      desc:"当前浏览器保存的 API Key 未通过 TMDB 校验，可能已输错或被重置，请重新输入。",
      btn:"重新输入 Key"
    },
    SERVER_KEY_INVALID: {
      title:"服务端密钥暂时不可用",
      desc:"站点配置的 TMDB 密钥校验失败。你可以输入自己的 API Key 继续浏览，密钥仅保存在当前浏览器。",
      btn:"输入我的 API Key"
    }
  };
  const t = map[code] || map.MISSING_API_KEY;
  $("#grid").innerHTML = `<div class="state">
    <div class="big">🔑</div>
    <h3>${t.title}</h3>
    <p>${t.desc}</p>
    <button class="retry" id="configKeyBtn">${t.btn}</button>
  </div>`;
}

function renderPager(){
  $("#pgTxt").innerHTML = `第 ${state.page} <small>/ ${state.totalPages}</small> 页`;
  $("#prevBtn").disabled = state.page<=1;
  $("#nextBtn").disabled = state.page>=state.totalPages;
}

// ---------- 6. 图片懒加载 ----------
let io;
function lazyObserve(){
  if(!io){
    io = new IntersectionObserver((entries)=>{
      entries.forEach(en=>{
        if(en.isIntersecting){
          const img=en.target;
          img.src=img.dataset.src;
          img.onload=()=>img.classList.add("loaded");
          io.unobserve(img);
        }
      });
    },{rootMargin:"200px"});
  }
  document.querySelectorAll("img[data-src]").forEach(img=>io.observe(img));
}

// ---------- 7. 详情弹窗 ----------
function openDetail(id){
  const it = state.items.find(x=>String(x.id)===String(id));
  if(!it) return;
  const isMovie = itemIsMovie(it);
  const title = it.title||it.name||"未命名";
  const date = it.release_date||it.first_air_date||"";
  const score = it.vote_average ? it.vote_average.toFixed(1) : null;
  const scoreTag = score ? `⭐ ${score} 分` : (state.mode==="browse"&&state.sortBy==="upcoming" ? "⏳ 待映" : "暂无评分");
  const mediaPath = isMovie ? "movie" : "tv";
  const sourceTag = `${typeTagOf(it,isMovie)} ${isMovie?"电影":"剧集"}`;
  $("#detailBox").innerHTML = `
    <button class="detail-close" id="dClose"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
    <div class="detail-hero">${it.backdrop_path?`<img src="${backdropUrl(it.backdrop_path)}" alt="">`:""}</div>
    <div class="detail-body">
      <h3>${esc(title)}</h3>
      <div class="detail-tags">
        <span class="tag hot">${scoreTag}</span>
        ${date?`<span class="tag">📅 ${dateText(date)}</span>`:""}
        <span class="tag">${sourceTag}</span>
        ${getGenreText(it.genre_ids,true)?`<span class="tag">${esc(getGenreText(it.genre_ids,true))}</span>`:""}
        <span class="tag" id="dMeta" hidden></span>
      </div>
      <div class="detail-providers" id="dProviders"></div>
      <p class="detail-overview">${esc(it.overview)|| "暂无简介，可前往 TMDB 查看更多信息。"}</p>
      <div class="detail-links">
        <a class="link-tmdb" href="https://www.themoviedb.org/${mediaPath}/${it.id}" target="_blank" rel="noopener">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14L21 3"/></svg>
          TMDB 详情页
        </a>
        <a class="link-search" href="https://www.justwatch.com/cn/search?q=${encodeURIComponent(title)}" target="_blank" rel="noopener">🔍 在 JustWatch 找播放源</a>
      </div>
    </div>`;
  showModal("#detailModal");
  $("#dClose").onclick = closeModals;
  // 详情头图加载完成后淡入（替代行内 onload）
  const heroImg = $("#detailBox .detail-hero img");
  if(heroImg){
    if(heroImg.complete) heroImg.classList.add("loaded");
    else heroImg.addEventListener("load",()=>heroImg.classList.add("loaded"),{once:true});
  }
  // 异步补充：剧集集数/季数 + 真实播放平台（TMDB watch providers）
  const provBox = $("#dProviders");
  provBox.innerHTML = `<div class="prov-empty">播放平台加载中…</div>`;
  loadDetailExtra(it.id, isMovie, $("#dMeta"), provBox);
}

/* 剧集状态英文 → 中文 */
const TV_STATUS_TEXT = {
  "Returning Series":"连载中",
  "Ended":"已完结",
  "In Production":"制作中",
  "Canceled":"已取消",
  "Pilot":"试播集"
};

/* 详情附加信息：集数/片长 + 播放平台。节点 isConnected 检查防止弹窗切换后的过期回填 */
async function loadDetailExtra(id, isMovie, metaEl, provEl){
  const media = isMovie ? "movie" : "tv";
  if(runtime.mode === "direct" && !getStoredKey()){ metaEl?.remove(); provEl && (provEl.innerHTML = ""); return; }
  try{
    const [detailRes, provRes] = await Promise.all([
      fetch(buildApiUrl(`/${media}/${id}`, {language:"zh-CN"})),
      fetch(buildApiUrl(`/${media}/${id}/watch/providers`))
    ]);
    if(metaEl?.isConnected){
      if(detailRes.ok){
        const d = await detailRes.json();
        let txt = "";
        if(isMovie){
          if(d.runtime) txt = `⏱ 片长 ${d.runtime} 分钟`;
        }else{
          const parts = [];
          if(d.number_of_seasons) parts.push(`${d.number_of_seasons} 季`);
          if(d.number_of_episodes) parts.push(`${d.number_of_episodes} 集`);
          const st = TV_STATUS_TEXT[d.status] || "";
          if(parts.length) txt = `🎬 共 ${parts.join(" · ")}${st?` · ${st}`:""}`;
          else if(st) txt = `📺 ${st}`;
        }
        if(txt){ metaEl.textContent = txt; metaEl.hidden = false; }
        else metaEl.remove();
      }else metaEl.remove();
    }
    if(provEl?.isConnected){
      provEl.innerHTML = provRes.ok
        ? renderProviders((await provRes.json()).results || {})
        : `<div class="prov-empty">暂未收录播放平台</div>`;
    }
  }catch{
    if(metaEl?.isConnected) metaEl.remove();
    if(provEl?.isConnected) provEl.innerHTML = `<div class="prov-empty">播放平台加载失败，可使用下方 JustWatch 查找</div>`;
  }
}

/* 常见地区代码 → 中文名 */
const REGION_NAME = {CN:"中国",HK:"香港",TW:"台湾",US:"美国",JP:"日本",KR:"韩国",GB:"英国"};

/* 取出某地区下真正有数据的平台渠道（订阅 → 免费/广告 → 租赁 → 购买） */
function regionGroups(r){
  if(!r) return [];
  return [
    r.flatrate,
    [...(r.free||[]), ...(r.ads||[])],
    r.rent,
    r.buy
  ].filter(l=>Array.isArray(l) && l.length);
}

/* 从 watch/providers 结果中按 中国→美国→其他地区 的顺序选首个有平台数据的地区并去重渲染 */
function renderProviders(results){
  const keys = Object.keys(results||{});
  const ordered = ["CN","US", ...keys.filter(k=>k!=="CN"&&k!=="US")];
  let picked = null, pickedCode = "";
  for(const code of ordered){
    const groups = regionGroups(results?.[code]);
    if(groups.length){ picked = groups; pickedCode = code; break; }
  }
  if(!picked) return `<div class="prov-empty">TMDB 暂未收录播放平台，可使用下方 JustWatch 查找</div>`;
  const regionName = REGION_NAME[pickedCode] || pickedCode;
  const seen = new Set();
  const chips = [];
  for(const list of picked){
    for(const p of list){
      if(seen.has(p.provider_id)) continue;
      seen.add(p.provider_id);
      chips.push(`<span class="provider" title="${esc(p.provider_name)}">
        ${p.logo_path?`<img src="${IMG}/w92${p.logo_path}" alt="" loading="lazy">`:""}
        <span>${esc(p.provider_name)}</span>
      </span>`);
    }
  }
  return `<div class="prov-label">▶ 播放平台 · ${regionName}区</div><div class="prov-list">${chips.join("")}</div>`;
}

// ---------- 8. 弹窗管理 ----------
function showModal(sel){
  closeModals();
  $(sel).classList.add("open");
  document.body.classList.add("no-scroll");
}
function closeModals(){
  document.querySelectorAll(".modal-layer.open").forEach(m=>m.classList.remove("open"));
  document.body.classList.remove("no-scroll");
}

// ---------- 8.5 API Key 设置弹窗 ----------
function openSettings(){
  const input = $("#apiKeyInput");
  input.value = getStoredKey();
  input.classList.remove("invalid");
  showModal("#settingsModal");
  setTimeout(()=>input.focus(),0);
}
function saveApiKey(){
  const input = $("#apiKeyInput");
  const v = input.value.trim();
  if(!v){ input.classList.add("invalid"); input.focus(); return; }
  setStoredKey(v);                // 仅保存在浏览器 localStorage，不回传服务器
  runtime.mode = "direct";        // 后续请求直连 TMDB
  applyKeyEntryVisibility();
  closeModals();
  state.page = 1;
  loadList();
}

// ---------- 9. 事件绑定 ----------

/* 退出搜索模式：清空输入并回到平台浏览 */
function exitSearch(){
  state.mode="browse";
  state.query="";
  $("#searchInput").value="";
  $("#searchClear").hidden=true;
}

/* 发起搜索 */
function submitSearch(){
  const q = $("#searchInput").value.trim();
  if(!q) return;
  state.mode="search";
  state.query=q;
  state.page=1;
  $("#searchClear").hidden=false;
  loadList();
  document.querySelector(".results-head").scrollIntoView({block:"start"});
}

$("#searchForm").addEventListener("submit",e=>{e.preventDefault();submitSearch();});
$("#searchInput").addEventListener("input",e=>{
  $("#searchClear").hidden = !e.target.value;
  if(!e.target.value && state.mode==="search"){
    exitSearch(); state.page=1; loadList();
  }
});
$("#searchClear").addEventListener("click",()=>{
  exitSearch();
  state.page=1; loadList();
  $("#searchInput").focus();
});

$("#chips").addEventListener("click",e=>{
  const b=e.target.closest(".chip"); if(!b) return;
  exitSearch();
  state.platform=b.dataset.v; state.page=1;
  renderChips(); loadList();
  document.querySelector(".toolbar").scrollIntoView({block:"start"});
});
$("#typeSeg").addEventListener("click",e=>{
  const b=e.target.closest("button"); if(!b||b.classList.contains("active")) return;
  exitSearch();
  $("#typeSeg").querySelectorAll("button").forEach(x=>x.classList.remove("active"));
  b.classList.add("active");
  state.mediaType=b.dataset.v; state.page=1; loadList();
});
$("#sortSeg").addEventListener("click",e=>{
  const b=e.target.closest("button"); if(!b||b.classList.contains("active")) return;
  exitSearch();
  $("#sortSeg").querySelectorAll("button").forEach(x=>x.classList.remove("active"));
  b.classList.add("active");
  state.sortBy=b.dataset.v; state.page=1; loadList();
});
$("#prevBtn").addEventListener("click",()=>{ if(state.page>1){state.page--;loadList();window.scrollTo({top:0,behavior:"smooth"});} });
$("#nextBtn").addEventListener("click",()=>{ if(state.page<state.totalPages){state.page++;loadList();window.scrollTo({top:0,behavior:"smooth"});} });
$("#grid").addEventListener("click",e=>{
  const retry=e.target.closest("#retryBtn"); if(retry){loadList();return;}
  const cfg=e.target.closest("#configKeyBtn"); if(cfg){openSettings();return;}
  const card=e.target.closest(".card[data-id]"); if(card) openDetail(card.dataset.id);
});

/* API Key 设置 */
$("#settingsBtn").addEventListener("click",openSettings);
$("#sClose").addEventListener("click",closeModals);
$("#apiKeySave").addEventListener("click",saveApiKey);
$("#apiKeyClear").addEventListener("click",()=>{
  setStoredKey("");
  const input=$("#apiKeyInput");
  input.value="";
  input.classList.remove("invalid");
  input.focus();
});
$("#apiKeyInput").addEventListener("keydown",e=>{ if(e.key==="Enter") saveApiKey(); });
$("#apiKeyInput").addEventListener("input",e=>e.target.classList.remove("invalid"));

document.querySelectorAll(".modal-mask").forEach(m=>m.addEventListener("click",closeModals));
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModals();});

// ---------- 10. 启动 ----------
renderChips();
(async function bootstrap(){
  await initRuntime();          // 先探测 Cloudflare 是否配置了服务端 Key
  applyKeyEntryVisibility();
  loadList();
})();
