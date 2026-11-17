/*
华住会新版签到（Quantumult X）

[rewrite_local]
^https:\/\/appgw\.huazhu\.com\/ url script-request-header https://raw.githubusercontent.com/pray1412/Script/main/hzh/hzh-new-signin.js

[task_local]
5 9 * * * https://raw.githubusercontent.com/pray1412/Script/main/hzh/hzh-new-signin.js, tag=华住会新版签到, enabled=true

[mitm]
hostname = appgw.huazhu.com

进入华住会 App 或打开签到页时会自动更新 Cookie；手动签到时还会记录实际请求方法。
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
  const requestUrl = $request.url || "";
  const capturedMethod = ($request.method || "GET").toUpperCase();
  const isSignInRequest = /^https:\/\/appgw\.huazhu\.com\/game\/sign_in(?:\?|$)/i.test(requestUrl);
  let previous;
  try {
    previous = JSON.parse($prefs.valueForKey(STORE_KEY) || "null");
  } catch (_) {
    previous = null;
  }
  const previousMethod = String(
    $prefs.valueForKey(METHOD_KEY) || (previous && previous.method) || "GET"
  ).toUpperCase();
  const method = isSignInRequest && ["GET", "POST"].includes(capturedMethod)
    ? capturedMethod
    : (["GET", "POST"].includes(previousMethod) ? previousMethod : "GET");

  if (!cookie) {
    console.log(`华住会：当前请求未携带 Cookie，已忽略：${requestUrl}`);
  } else {
    const cookieChanged = cookie !== $prefs.valueForKey(COOKIE_KEY);
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
    console.log(`华住会：Cookie ${ok ? "已保存" : "保存失败"}，签到方法 ${method}`);
    if (!ok) {
      $notify("华住会", "凭证保存失败", "请检查 Quantumult X 配置");
    } else if (cookieChanged) {
      $notify("华住会", "Cookie 已自动更新", isSignInRequest ? `签到方法：${method}` : "已从 App 请求中获取");
    }
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
