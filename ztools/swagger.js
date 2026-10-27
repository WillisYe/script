// deno run -A index.js

// 步骤1：从已有 swagger 链接提取路径模板
function extractTemplates() {
  // 默认模板
  const defaults = [
    "/swagger/index.html",
    "/swagger/ui/index",
    "/swagger-ui/index.html",
    "/swagger-ui.html",
  ];
  return defaults;
}

// 步骤2：对新接口地址逐级生成候选文档链接
function generateCandidates(apiUrl, templates) {
  const url = new URL(apiUrl);
  const segments = url.pathname.split("/").filter(Boolean);
  const candidates = [];
  for (let i = 0; i <= segments.length; i++) {
    const basePath = segments.slice(0, i).join("/");
    const base = `${url.protocol}//${url.host}${basePath ? "/" + basePath : ""}`;
    for (const template of templates) {
      candidates.push(base + template);
    }
  }
  return [...new Set(candidates)];
}

// 步骤3：验证链接是否可访问
async function verifyUrl(url) {
  // 先尝试 HEAD
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeoutId);
    if (response.status < 400) {
      return true;
    }
  } catch {
    // HEAD 失败，继续尝试 GET
  }

  // HEAD 不可用或返回 4xx，fallback 到 GET
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeoutId);
    return response.status < 400;
  } catch {
    return false;
  }
}

// 步骤4：猜测 swagger 文档链接
async function guessSwaggerDoc(apiUrl) {
  const templates = extractTemplates()
  const candidates = generateCandidates(apiUrl, templates);
  const verifyResults = [];
  let docUrl = null;

  for (const candidate of candidates) {
    const ok = await verifyUrl(candidate);
    verifyResults.push({ url: candidate, accessible: ok });
    if (ok && !docUrl) {
      docUrl = candidate;
    }
  }

  return { templates, candidates, verifyResults, docUrl };
}

// 示例
const apiUrl =
  "http://test1gatewayexternal.meiyasltest.com:9090/ncrmapi/external/clientapi/crm/IncCrmPolicyManage/ReasonListGet";
const { templates, candidates, verifyResults, docUrl } = await guessSwaggerDoc(apiUrl);

console.log("猜测的文档链接:", docUrl);