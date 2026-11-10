/* Game rules are separate from the screen, so they can be tested without a browser. */
(function (root) {
  const RULES = { levelSize: 100, moveChance: 0.001, spamWindow: 2000, maxAttempts: 6, baseCooldown: 15000, maxCooldown: 120000 };
  const BADGES = [
    ['first', 'First contact', 'Accept 1 click', 'clicks', 1],
    ['ten', 'Due diligence', 'Accept 10 clicks', 'clicks', 10],
    ['hundred', 'Rock apprentice', 'Accept 100 clicks', 'clicks', 100],
    ['fivehundred', 'Stone specialist', 'Accept 500 clicks', 'clicks', 500],
    ['thousand', 'Geological dedication', 'Accept 1,000 clicks', 'clicks', 1000],
    ['tenthousand', 'Ten thousand reasons', 'Accept 10,000 clicks', 'clicks', 10000],
    ['minute', 'A quiet minute', 'Spend 1 minute here', 'waitMs', 60000],
    ['five', 'Patient observer', 'Spend 5 minutes here', 'waitMs', 300000],
    ['quarter', 'No rush whatsoever', 'Spend 15 minutes here', 'waitMs', 900000],
    ['hour', 'Honorary sediment', 'Spend 1 hour here', 'waitMs', 3600000],
    ['level5', 'Hidden gem', 'Reach level 5', 'level', 5],
    ['movement', 'It actually moved!', 'Witness a rare movement', 'moves', 1]
  ];
  function fresh() { return { name: 'Derek', clicks: 0, level: 1, progress: 0, waitMs: 0, moves: 0, strikes: 0, cooldownUntil: 0, attempts: [], badges: [], calm: false, legacyInspections: 0, theme: 'day', goal: 1000, gamesWon: 0, errorPending: '', lastErrorAt: 0 }; }
  function restore(raw, now = Date.now()) {
    const s = fresh(); if (!raw || typeof raw !== 'object') return s;
    for (const key of ['clicks','progress','waitMs','moves','strikes','cooldownUntil','legacyInspections','gamesWon','lastErrorAt']) {
      if (Number.isSafeInteger(raw[key]) && raw[key] >= 0) s[key] = raw[key];
    }
    if (Number.isSafeInteger(raw.level) && raw.level >= 1) s.level = raw.level;
    s.level = Math.min(s.level, Math.floor(s.clicks / RULES.levelSize) + 1);
    s.progress = Math.min(99, s.progress, s.clicks);
    s.moves = Math.min(s.moves, s.clicks);
    s.strikes = Math.min(s.strikes, 100);
    s.cooldownUntil = Math.min(s.cooldownUntil, now + RULES.maxCooldown);
    s.attempts = Array.isArray(raw.attempts) ? raw.attempts.filter(t => Number.isFinite(t) && t <= now && now - t < RULES.spamWindow).slice(-6) : [];
    s.name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0,40) : 'Derek';
    s.calm = raw.calm === true;
    s.theme = ['day','night','lilac'].includes(raw.theme) ? raw.theme : 'day';
    s.goal = Number.isSafeInteger(raw.goal) && raw.goal >= 1 && raw.goal <= 100000 ? raw.goal : 1000;
    s.errorPending = typeof raw.errorPending === 'string' ? raw.errorPending.slice(0,160) : '';
    s.badges = Array.isArray(raw.badges) ? [...new Set(raw.badges.filter(id => BADGES.some(b => b[0] === id)))] : [];
    unlock(s); return s;
  }
  function unlock(s) {
    const earned = [];
    for (const [id, title, , stat, target] of BADGES) {
      if (s[stat] >= target && !s.badges.includes(id)) { s.badges.push(id); earned.push(title); }
    }
    return earned;
  }
  // Every interaction route shares this gate. Rejected attempts cannot earn clicks.
  function attempt(s, now) {
    if (now < s.cooldownUntil) return { type: 'cooldown' };
    s.attempts = s.attempts.filter(t => now - t < RULES.spamWindow);
    s.attempts.push(now);
    if (s.attempts.length > RULES.maxAttempts) {
      s.strikes += 1;
      const duration = Math.min(RULES.maxCooldown, RULES.baseCooldown * 2 ** Math.min(s.strikes - 1, 3));
      s.cooldownUntil = now + duration; s.progress = 0; s.attempts = [];
      return { type: 'penalty', duration };
    }
    return { type: 'allowed' };
  }
  function reward(s, random = Math.random) {
    s.clicks += 1; s.progress += 1;
    const levelUp = s.progress >= RULES.levelSize;
    if (levelUp) { s.level += 1; s.progress = 0; }
    // 0.10% = 0.001 = one in 1,000, independently on every accepted click.
    const moved = random() < RULES.moveChance;
    if (moved) s.moves += 1;
    return { type: 'accepted', levelUp, moved, earned: unlock(s) };
  }
  function click(s, now, random = Math.random, correct = true) {
    const gate = attempt(s, now); if (gate.type !== 'allowed') return gate;
    return correct ? reward(s, random) : { type: 'miss' };
  }
  function wait(s, ms, visible) {
    if (visible && Number.isFinite(ms) && ms > 0) s.waitMs += Math.floor(Math.min(ms, 2000));
    return unlock(s);
  }
  function difficulty(level) { return { size: Math.max(44, 106 - (level - 1) * 7), decoys: Math.min(12, Math.max(0, level - 1)), contrast: Math.max(.65, 1 - (level - 1) * .025) }; }
  function score(s) { return s.clicks * 10 + (s.level - 1) * 100 + s.moves * 1000 + s.gamesWon * 100; }
  function goalStats(s) { const remaining = Math.max(0,s.goal-s.clicks); return { remaining, chance: (1 - Math.pow(1-RULES.moveChance, remaining)) * 100 }; }
  const api = { score, goalStats, RULES, BADGES, fresh, restore, unlock, attempt, reward, click, wait, difficulty };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PebbleGame = api;
})(globalThis);
