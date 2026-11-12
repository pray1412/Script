try {
  const obj = JSON.parse($response.body);
  const skipTypes = ['SIDE_QUEST_RAMP_UP_PRACTICE', 'MATCH_PRACTICE'];
  if (obj.type && !skipTypes.includes(obj.type)) {
    ['challenges','adaptiveChallenges','adaptiveInterleavedChallenges','mistakesReplacementChallenges']
      .forEach(key => { if (Array.isArray(obj[key]) && obj[key].length) obj[key] = []; });
  }
  if (Array.isArray(obj.elements) && obj.elements.length) obj.elements = [];
  $done({ body: JSON.stringify(obj) });
} catch (err) { console.log('lingoDuo-clear: ' + err); $done({}); }
