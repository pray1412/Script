/*
Readify 7 天读书挑战签到（Quantumult X）

[rewrite_local]
^https:\/\/readifyapp\.voiceclub\.cn\/api\/ url script-request-header https://raw.githubusercontent.com/pray1412/Script/main/readify/readify-streak.js

[task_local]
10 9 * * * https://raw.githubusercontent.com/pray1412/Script/main/readify/readify-streak.js, tag=Readify 签到, enabled=true

[mitm]
hostname = readifyapp.voiceclub.cn

登录 Readify 后进入 App，任意携带 x-token 的 API 请求都会自动更新签到凭证。
*/

const HEADERS_KEY = "READIFY_STREAK_HEADERS";
const TOKEN_KEY = "READIFY_TOKEN";
const USER_ID_KEY = "READIFY_USER_ID";
const DEVICE_ID_KEY = "READIFY_DEVICE_ID";
const CAMPAIGN_KEY = "READIFY_CAMPAIGN_ID";
const DEFAULT_CAMPAIGN_ID = "reading-streak-7d-202607";
const CHECK_IN_URL = "https://readifyapp.voiceclub.cn/api/campaigns/streaks";

function header(headers, name) {
  const key = Object.keys(headers || {}).find(item => item.toLowerCase() === name.toLowerCase());
  return key ? headers[key] : "";
}

function storedHeaders() {
  try {
    return JSON.parse($prefs.valueForKey(HEADERS_KEY) || "{}");
  } catch (_) {
    return {};
  }
}

function captureHeaders(source) {
  const names = [
    "x-app-name", "x-client-sys-region", "x-lang", "x-user-agent", "x-os",
    "x-device-id", "x-v", "user-agent", "accept-language", "x-user-id",
    "x-time-zone", "x-token"
  ];
  return names.reduce((result, name) => {
    const value = header(source, name);
    if (value) result[name] = value;
    return result;
  }, {});
}

function finish(value) {
  $done(value || {});
}

if (typeof $request !== "undefined") {
  const captured = captureHeaders($request.headers);
  const token = captured["x-token"];
  if (!token) {
    console.log(`Readify：请求未携带 x-token，已忽略：${$request.url || ""}`);
    finish();
  } else {
    const previousToken = $prefs.valueForKey(TOKEN_KEY) || storedHeaders()["x-token"] || "";
    const ok = $prefs.setValueForKey(JSON.stringify(captured), HEADERS_KEY) &&
      $prefs.setValueForKey(token, TOKEN_KEY) &&
      $prefs.setValueForKey(captured["x-user-id"] || "", USER_ID_KEY) &&
      $prefs.setValueForKey(captured["x-device-id"] || "", DEVICE_ID_KEY);
    console.log(`Readify：登录凭证${ok ? "已保存" : "保存失败"}`);
    if (!ok) {
      $notify("Readify", "登录凭证保存失败", "请检查 Quantumult X 配置");
    } else if (token !== previousToken) {
      $notify("Readify", "登录凭证已自动更新", "现在可以运行签到任务");
    }
    finish();
  }
} else {
  const saved = storedHeaders();
  const token = ($prefs.valueForKey(TOKEN_KEY) || saved["x-token"] || "").trim();
  const userId = ($prefs.valueForKey(USER_ID_KEY) || saved["x-user-id"] || "").trim();
  const deviceId = ($prefs.valueForKey(DEVICE_ID_KEY) || saved["x-device-id"] || "").trim();
  const campaignId = ($prefs.valueForKey(CAMPAIGN_KEY) || DEFAULT_CAMPAIGN_ID).trim();

  if (!token || !userId) {
    $notify("Readify", "尚未获取登录凭证", "请先登录并进入 Readify App");
    finish();
  } else {
    const headers = Object.assign({}, saved, {
      "x-app-name": saved["x-app-name"] || "readifyai",
      "x-client-sys-region": saved["x-client-sys-region"] || "CN",
      "x-lang": saved["x-lang"] || "zh-Hans",
      "x-user-agent": saved["x-user-agent"] || "iOS/3.5.0",
      "x-v": saved["x-v"] || "v1",
      "x-user-id": userId,
      "x-time-zone": saved["x-time-zone"] || "Asia/Shanghai",
      "x-token": token,
      "Content-Type": "application/json",
      "Accept": "application/json, text/plain, */*",
      "Origin": "https://readifyapp.voiceclub.cn",
      "Referer": "https://readifyapp.voiceclub.cn/activity/check-in/7DayChallenge?immersive=1"
    });
    if (deviceId) headers["x-device-id"] = deviceId;

    $task.fetch({
      url: CHECK_IN_URL,
      method: "POST",
      headers,
      body: JSON.stringify({ campaignId })
    }).then(response => {
      try {
        const result = JSON.parse(response.body);
        const data = result.data || {};
        if (response.statusCode !== 200 || result.code !== 0) {
          $notify("Readify 签到失败", `HTTP ${response.statusCode} / ${result.code == null ? "未知" : result.code}`, result.message || "服务器返回异常");
        } else {
          const day = Number(data.currentDay) || 0;
          const already = data.checkInResult === "ALREADY_CHECKED_IN";
          const checked = data.streakedToday === true || data.checkInResult === "SUCCESS" || data.checkInResult === "CHECKED_IN";
          const interrupted = data.interrupted === true ? "，本轮曾中断并已重置" : "";

          if (data.canClaim === true || (day >= 7 && !data.claimedAt && data.roundStatus !== "CLAIMED_WAITING")) {
            $notify("Readify 第 7 天签到完成", `已连续签到 ${day} 天${interrupted}`, "奖励已可领取，请进入活动页面领取");
          } else if (already) {
            $notify("Readify 今日已签到", `已签到 ${day} 天${interrupted}`, "无需重复操作");
          } else if (checked) {
            $notify("Readify 签到成功", `已签到 ${day} 天${interrupted}`, `距离第 7 天还有 ${Math.max(0, 7 - day)} 天`);
          } else {
            $notify("Readify 签到未完成", `当前已签到 ${day} 天`, data.canCheckIn === true ? "服务器仍显示今日可签到，请稍后重试" : (result.message || "请进入活动页面核实"));
          }
        }
      } catch (error) {
        console.log(`Readify：响应解析失败：${error}`);
        $notify("Readify 签到异常", "无法解析服务器响应", `HTTP ${response.statusCode}`);
      }
      finish();
    }, error => {
      console.log(`Readify：请求失败：${error.error || error}`);
      $notify("Readify 签到失败", "网络请求异常", String(error.error || error));
      finish();
    });
  }
}
