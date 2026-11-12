// Set timer_mins to a positive number of minutes.
const CONFIG = { timer_mins: 60 };
try {
  const obj = JSON.parse($response.body);
  const seconds = Math.floor(Number(CONFIG.timer_mins) * 60);
  if (seconds > 0 && Array.isArray(obj.liveOpsChallenges)) {
    obj.liveOpsChallenges.forEach(challenge => {
      if (challenge.initialTime) challenge.initialTime = seconds;
      if (challenge.initialLevelTimes) challenge.initialLevelTimes = challenge.initialLevelTimes.map(() => seconds);
      if (challenge.initialSessionTimes) challenge.initialSessionTimes = challenge.initialSessionTimes.map(() => seconds);
    });
  }
  $done({ body: JSON.stringify(obj) });
} catch (err) { console.log('lingoDuo-time: ' + err); $done({}); }
