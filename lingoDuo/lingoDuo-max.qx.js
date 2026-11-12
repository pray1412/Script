// Quantumult X adaptation of TAKAGIVEGETA's Duolingo script.
// Edit these options to configure features. Unlike Loon, QX has no plugin argument toggles.
const CONFIG = { xp_boost: false, multiplier: 2, unlock_all: false };
try {
  const obj = JSON.parse($response.body);
  const now = Math.floor(Date.now() / 1000);
  function modify(userdata) {
    if (!userdata || typeof userdata !== 'object') return;
    if (!Array.isArray(userdata.shopItems)) userdata.shopItems = [];
    if (!userdata.shopItems.some(item => item.id === 'gold_subscription')) {
      userdata.shopItems.push({
        id: 'gold_subscription', purchaseDate: now - 172800, purchasePrice: 0,
        subscriptionInfo: { expectedExpiration: now + 31536000,
          productId: 'com.duolingo.DuolingoMobile.subscription.Gold.TwelveMonth.24Q2Max.168',
          renewer: 'APPLE', renewing: true, tier: 'twelve_month', type: 'gold' }
      });
    }
    userdata.subscriberLevel = 'GOLD';
    if (!userdata.trackingProperties) userdata.trackingProperties = {};
    ['has_item_immersive_subscription', 'has_item_premium_subscription',
      'has_item_live_subscription', 'has_item_gold_subscription',
      'has_item_max_subscription'].forEach(k => userdata.trackingProperties[k] = true);
    if (CONFIG.xp_boost) {
      const factor = Number(CONFIG.multiplier) || 2;
      let boost = userdata.shopItems.find(item => item.id === 'xp_boost_stackable');
      if (!boost) {
        boost = { id: 'xp_boost_stackable', purchasePrice: 0 };
        userdata.shopItems.push(boost);
      }
      boost.purchaseDate = now;
      boost.expectedExpirationDate = now + 3600;
      boost.xpBoostMultiplier = factor;
    }
    if (CONFIG.unlock_all && userdata.currentCourse && Array.isArray(userdata.currentCourse.pathSectioned)) {
      userdata.currentCourse.pathSectioned.forEach(section =>
        (section.units || []).forEach(unit =>
          (unit.levels || []).forEach(level => { if (level.state === 'locked') level.state = 'active'; })
        )
      );
    }
  }
  if (Array.isArray(obj.responses) && obj.responses.length >= 2) {
    if (obj.responses[0].headers && 'etag' in obj.responses[0].headers) {
      $done({});
    } else {
      const body = obj.responses[0].body;
      if (typeof body === 'string') {
        const user = JSON.parse(body);
        modify(user);
        obj.responses[0].body = JSON.stringify(user);
      } else {
        modify(body);
      }
      $done({ body: JSON.stringify(obj) });
    }
  } else if (obj && typeof obj === 'object' &&
    (obj.shopItems !== undefined || obj.subscriberLevel !== undefined ||
      (obj.id && obj.trackingProperties))) {
    modify(obj);
    $done({ body: JSON.stringify(obj) });
  } else $done({});
} catch (err) { console.log('lingoDuo-max: ' + err); $done({}); }
