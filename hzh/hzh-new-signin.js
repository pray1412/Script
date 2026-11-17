/*
华住会新版签到（Quantumult X）

[rewrite_local]
^https:\/\/appgw\.huazhu\.com\/game\/sign_in\? url script-request-header https://raw.githubusercontent.com/pray1412/Script/main/hzh/hzh-new-signin.js

[task_local]
5 9 * * * https://raw.githubusercontent.com/pray1412/Script/main/hzh/hzh-new-signin.js, tag=华住会新版签到, enabled=true

[mitm]
hostname = appgw.huazhu.com

首次使用时，在华住会 App 手动签到一次以记录请求方法和 Cookie。
*/

const STORE_KEY = "HZH_NEW_SIGNIN_REQUEST";
const COOKIE_KEY = "HZH_NEW_SIGNIN_COOKIE";
const METHOD_KEY = "HZH_NEW_SIGNIN_METHOD";
const ENDPOINT = "https://appgw.huazhu.com/game/sign_in";

function header(headers, name) {
  const key = Object.keys(headers || {}).find(k => k.toLowerCase() === name.toLowerCase());
  return key ? headers[key] : "";
}

function finish() {
  $done({});
}

if (typeof $request !== "undefined") {
  const cookie = header($request.headers, "Cookie");
  const method = ($request.method || "GET").toUpperCase();

  if (!cookie || !["GET", "POST"].includes(method)) {
    console.log("华住会：未获取到有效 Cookie 或请求方法");
    $notify("华住会", "获取签到请求失败", "请在 App 内手动签到后重试");
  } else {
    const saved = {
      cookie,
      method,
      userAgent: header($request.headers, "User-Agent"),
      clientPlatform: header($request.headers, "Client-Platform") || "APP-IOS",
      origin: header($request.headers, "Origin") || "https://cdn.huazhu.com",
      referer: header($request.headers, "Referer") || "https://cdn.huazhu.com/"
    };
    const ok = $prefs.setValueForKey(JSON.stringify(saved), STORE_KEY) &&
      $prefs.setValueForKey(cookie, COOKIE_KEY) &&
      $prefs.setValueForKey(method, METHOD_KEY);
    console.log(`华住会：签到请求${ok ? "已保存" : "保存失败"}，方法 ${method}`);
    $notify("华住会", ok ? "新版签到凭证已获取" : "凭证保存失败", ok ? "可运行定时任务" : "请检查 Quantumult X 配置");
  }
  finish();
} else {
  let saved;
  try {
    saved = JSON.parse($prefs.valueForKey(STORE_KEY) || "null");
  } catch (_) {
    saved = null;
  }

  const cookie = ($prefs.valueForKey(COOKIE_KEY) || (saved && saved.cookie) || "")
    .replace(/^Cookie:\s*/i, "").trim();
  const method = String($prefs.valueForKey(METHOD_KEY) || (saved && saved.method) || "GET")
    .trim().toUpperCase();

  if (!cookie || !["GET", "POST"].includes(method)) {
    $notify("华住会", "尚未获取新版签到凭证", "请先在 App 内手动签到一次");
    finish();
  } else {
    const headers = {
      "Cookie": cookie,
      "Client-Platform": (saved && saved.clientPlatform) || "APP-IOS",
      "Origin": (saved && saved.origin) || "https://cdn.huazhu.com",
      "Referer": (saved && saved.referer) || "https://cdn.huazhu.com/",
      "Accept": "application/json"
    };
    if (saved && saved.userAgent) headers["User-Agent"] = saved.userAgent;

    const request = {
      url: `${ENDPOINT}?date=${Math.floor(Date.now() / 1000)}`,
      method,
      headers
    };

    $task.fetch(request).then(response => {
      try {
        const result = JSON.parse(response.body);
        const content = result.content || {};
        if (response.statusCode === 200 && result.businessCode === "1000" && content.signResult === true) {
          const points = content.point == null ? "" : `，获得 ${content.point} 积分`;
          $notify("华住会签到成功", `今日签到完成${points}`, "");
        } else {
          const detail = result.message || result.responseDes || "未确认签到成功，请在 App 内核实";
          $notify("华住会签到未成功", `HTTP ${response.statusCode} / ${result.businessCode || result.code || "未知"}`, detail);
        }
      } catch (error) {
        console.log(`华住会：响应解析失败：${error}`);
        $notify("华住会签到异常", "无法解析服务器响应", `HTTP ${response.statusCode}`);
      }
      finish();
    }, error => {
      console.log(`华住会：请求失败：${error.error || error}`);
      $notify("华住会签到失败", "网络请求异常", String(error.error || error));
      finish();
    });
  }
}
