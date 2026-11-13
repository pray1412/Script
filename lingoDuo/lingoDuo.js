// Quantumult X adaptation of TAKAGIVEGETA's Duolingo scripts.
// Edit these switches to control which response fields are rewritten.
const CONFIG = {
  max: true,
  xpBoost: false,
  xpMultiplier: 2,
  unlockAll: false,
  challengeTime: false,
  challengeMinutes: 60,
  instantClear: false
};

// Keep these URL patterns in sync with lingoDuo-QX.conf.
const USER_URL = /^https?:\/\/(?:ios-api-[a-z0-9-]+|api\d+)\.duolingo\.(?:cn|com)\/2023-05-23\/(?:batch|users\/[^\/?#]+)(?:[?#]|$)/i;
const CHALLENGE_URL = /^https?:\/\/(?:ios-api-[a-z0-9-]+|api\d+)\.duolingo\.(?:cn|com)\/[^?#]*\/live-ops-challenges(?:[\/?#]|$)/i;
const SESSION_URL = /^https?:\/\/(?:ios-api-[a-z0-9-]+|api\d+|stories)\.duolingo\.(?:cn|com)\/(?:[^?#]*\/sessions|api2\/stories)(?:[\/?#]|$)/i;

function modifyUser(user) {
  if (!user || typeof user !== 'object' || Array.isArray(user)) return false;

  if (CONFIG.max || CONFIG.xpBoost) {
    const now = Math.floor(Date.now() / 1000);
    if (!Array.isArray(user.shopItems)) user.shopItems = [];

    if (CONFIG.max) {
      if (!user.shopItems.some(item => item && item.id === 'gold_subscription')) {
        user.shopItems.push({
          id: 'gold_subscription',
          purchaseDate: now - 172800,
          purchasePrice: 0,
          subscriptionInfo: {
            expectedExpiration: now + 31536000,
            productId: 'com.duolingo.DuolingoMobile.subscription.Gold.TwelveMonth.24Q2Max.168',
            renewer: 'APPLE',
            renewing: true,
            tier: 'twelve_month',
            type: 'gold'
          }
        });
      }
      user.subscriberLevel = 'GOLD';
      if (!user.trackingProperties || typeof user.trackingProperties !== 'object') {
        user.trackingProperties = {};
      }
      [
        'has_item_immersive_subscription', 'has_item_premium_subscription',
        'has_item_live_subscription', 'has_item_gold_subscription',
        'has_item_max_subscription'
      ].forEach(key => { user.trackingProperties[key] = true; });
    }

    if (CONFIG.xpBoost) {
      let boost = user.shopItems.find(item => item && item.id === 'xp_boost_stackable');
      if (!boost) {
        boost = { id: 'xp_boost_stackable', purchasePrice: 0 };
        user.shopItems.push(boost);
      }
      boost.purchaseDate = now;
      boost.expectedExpirationDate = now + 3600;
      boost.xpBoostMultiplier = Number(CONFIG.xpMultiplier) || 2;
    }
  }

  if (CONFIG.unlockAll && user.currentCourse && Array.isArray(user.currentCourse.pathSectioned)) {
    user.currentCourse.pathSectioned.forEach(section =>
      (section.units || []).forEach(unit =>
        (unit.levels || []).forEach(level => {
          if (level.state === 'locked') level.state = 'active';
        })
      )
    );
  }

  return true;
}

function rewriteUser(obj) {
  if (Array.isArray(obj.responses) && obj.responses.length >= 2) {
    const first = obj.responses[0];
    if (!first || Object.keys(first.headers || {}).some(key => key.toLowerCase() === 'etag')) {
      return false;
    }
    if (typeof first.body !== 'string') return modifyUser(first.body);

    const user = JSON.parse(first.body);
    if (!modifyUser(user)) return false;
    first.body = JSON.stringify(user);
    return true;
  }

  return (obj.shopItems !== undefined || obj.subscriberLevel !== undefined ||
    (obj.id && obj.trackingProperties)) && modifyUser(obj);
}

function rewriteChallenge(obj) {
  const seconds = Math.floor(Number(CONFIG.challengeMinutes) * 60);
  if (!Number.isFinite(seconds) || seconds <= 0 || !Array.isArray(obj.liveOpsChallenges)) {
    return false;
  }
  obj.liveOpsChallenges.forEach(challenge => {
    if (challenge.initialTime) challenge.initialTime = seconds;
    if (Array.isArray(challenge.initialLevelTimes)) {
      challenge.initialLevelTimes = challenge.initialLevelTimes.map(() => seconds);
    }
    if (Array.isArray(challenge.initialSessionTimes)) {
      challenge.initialSessionTimes = challenge.initialSessionTimes.map(() => seconds);
    }
  });
  return true;
}

function rewriteSession(obj) {
  const skipTypes = ['SIDE_QUEST_RAMP_UP_PRACTICE', 'MATCH_PRACTICE'];
  if (obj.type && !skipTypes.includes(obj.type)) {
    [
      'challenges', 'adaptiveChallenges', 'adaptiveInterleavedChallenges',
      'mistakesReplacementChallenges'
    ].forEach(key => {
      if (Array.isArray(obj[key]) && obj[key].length) obj[key] = [];
    });
  }
  if (Array.isArray(obj.elements) && obj.elements.length) obj.elements = [];
  return true;
}

function rewrite() {
  const url = $request.url;
  let handler;
  if (USER_URL.test(url)) {
    if (CONFIG.max || CONFIG.xpBoost || CONFIG.unlockAll) handler = rewriteUser;
  } else if (CHALLENGE_URL.test(url)) {
    if (CONFIG.challengeTime) handler = rewriteChallenge;
  } else if (SESSION_URL.test(url)) {
    if (CONFIG.instantClear) handler = rewriteSession;
  }

  if (!handler || typeof $response.body !== 'string') return {};
  const obj = JSON.parse($response.body);
  if (!obj || typeof obj !== 'object' || Array.isArray(obj) || !handler(obj)) return {};
  return { body: JSON.stringify(obj) };
}

let result = {};
try {
  result = rewrite();
} catch (error) {
  console.log('lingoDuo: ' + error);
}
$done(result);
