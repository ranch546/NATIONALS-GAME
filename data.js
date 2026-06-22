/**
 * ═══════════════════════════════════════════════════════════════════════════
 * data.js — RULES & GAME DATA (Presentation / Judge Guide)
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT IT DOES:
 *   Stores all game constants and math (no HTML). Single source of truth for rules.
 *
 * KEY SECTIONS:
 *   TIMELINES        — Visual theme for the quiz journey
 *   UPGRADES         — 5 shop items (coins, time, lucky save, eliminator, XP)
 *   pickAdaptiveQuestions() — Picks 10 Qs matched to player skill level
 *   addXp()          — Level-up logic: +10 coins per level gained
 *   pointsFor()      — Score formula (difficulty + streak + upgrades)
 *   defaultSave()    — Starting profile: 3 hearts per run, 0 XP, empty upgrades
 * ═══════════════════════════════════════════════════════════════════════════
 */
/* Journey Through the 1980s — data & progression */
window.AN = window.AN || {};

AN.GAME_TITLE = '1980s Time Travel Trivia Quiz';
AN.STOPS_PER_RUN = 90;      // 30 easy + 30 medium + 30 hard per full run
AN.RUN_LEVEL_COUNTS = { easy: 30, medium: 30, hard: 30 }; // Level 1 → 2 → 3
AN.START_HEARTS = 3;        // [JUDGE] Lives at start of each run
AN.MAX_HEARTS = 9;          // Max hearts (start at 3, earn more from levels/challenges)
AN.LIFELINE_GUESS_TIME = 10; // Seconds to answer after 50/50 lifeline
AN.TRIVIA_TIME = 15;        // [JUDGE] Seconds per question (upgrade adds +2 each level)
AN.SCORE_CORRECT = 25;      // Points per correct answer
AN.SCORE_WRONG = -10;       // Points lost per wrong answer
AN.SCORE_LIFELINE = 0;      // Lifeline challenge awards hearts, not points
AN.LIFELINE_SPAWN_Z = -12;
AN.LIFELINE_FINISH_Z = 14;

/** Single journey — questions play in fixed difficulty order */
AN.JOURNEY_ID = 'journey';
AN.TIMELINES = {
    journey: {
        id: 'journey', name: 'Time Travel Quiz', icon: '⏳',
        category: '1980s', tagline: '90 questions per run · easy → medium → hard',
        art: 'linear-gradient(135deg,#ff2bd6,#00f5ff,#ffd54a)',
        sky: 0x12101c, fog: 0x0e0c18, accent: 0xff2bd6, floor: 0x1a1030
    }
};
AN.PLAT_COLOR = 0x2a2a36;
AN.PLAT_DARK = 0x1e1e28;
AN.LAVA_COLOR = 0x4a1028;
AN.ANSWER_COLORS = [0xe63946, 0x00b4d8, 0xffd60a, 0x2dc653];
AN.ANSWER_LABELS = ['A', 'B', 'C', 'D'];

/** Each year of the decade — visual identity for Lifeline Runs */
AN.YEARS = {
    1980: {
        year: 1980, title: 'Miracle on Ice', landmark: '🏒 Lake Placid',
        tagline: 'U.S. hockey upset over USSR at the 1980 Winter Olympics',
        sky: 0x0a1830, fog: 0x081428, accent: 0x88ccff, floor: 0x1a3050,
        art: 'linear-gradient(160deg,#0a2848,#88ccff)'
    },
    1981: {
        year: 1981, title: 'MTV Revolution', landmark: '📺 Music Television',
        tagline: 'Music videos change pop culture forever',
        sky: 0x180818, fog: 0x120610, accent: 0xff2bd6, floor: 0x2a1030,
        art: 'linear-gradient(160deg,#ff2bd6,#220044)'
    },
    1982: {
        year: 1982, title: 'Arcade Golden Age', landmark: '🕹️ Pac-Man Fever',
        tagline: 'Neon arcades light up the nation',
        sky: 0x101018, fog: 0x0c0c14, accent: 0xffd60a, floor: 0x1a1a28,
        art: 'linear-gradient(160deg,#ffd60a,#331100)'
    },
    1983: {
        year: 1983, title: 'Cellular Dawn', landmark: '📱 First Mobile Call',
        tagline: 'The brick phone arrives in America',
        sky: 0x081820, fog: 0x061418, accent: 0x00f5ff, floor: 0x0a2030,
        art: 'linear-gradient(160deg,#00f5ff,#003344)'
    },
    1984: {
        year: 1984, title: 'LA Olympics', landmark: '🏟️ Los Angeles',
        tagline: 'Carl Lewis · Mary Lou · Olympic spectacle',
        sky: 0x1a1028, fog: 0x140c20, accent: 0xffd54a, floor: 0x281840,
        art: 'linear-gradient(160deg,#e63946,#ffd54a,#00b4d8)'
    },
    1985: {
        year: 1985, title: 'Windows Era', landmark: '💻 Microsoft Windows',
        tagline: 'Personal computing goes mainstream',
        sky: 0x0a1428, fog: 0x081020, accent: 0x4488ff, floor: 0x101830,
        art: 'linear-gradient(160deg,#4488ff,#0a1830)'
    },
    1986: {
        year: 1986, title: 'Challenger & Chernobyl', landmark: '🚀 Space & Science',
        tagline: 'A year of triumph and tragedy',
        sky: 0x080818, fog: 0x060610, accent: 0xaaaaff, floor: 0x101028,
        art: 'linear-gradient(160deg,#1a1a40,#6666cc)'
    },
    1987: {
        year: 1987, title: 'INF Treaty', landmark: '🕊️ Diplomacy',
        tagline: 'Superpowers step back from the brink',
        sky: 0x181018, fog: 0x120c10, accent: 0xff6688, floor: 0x201018,
        art: 'linear-gradient(160deg,#cc2244,#441122)'
    },
    1988: {
        year: 1988, title: 'Seoul Olympics', landmark: '🌏 South Korea',
        tagline: 'Global games · Ben Johnson · glory',
        sky: 0x101828, fog: 0x0c1420, accent: 0xbb88ff, floor: 0x181030,
        art: 'linear-gradient(160deg,#6633aa,#bb88ff)'
    },
    1989: {
        year: 1989, title: 'Wall Falls', landmark: '🧱 Berlin',
        tagline: 'The decade ends · history reshaped',
        sky: 0x141414, fog: 0x101010, accent: 0xcccccc, floor: 0x222228,
        art: 'linear-gradient(160deg,#888,#333,#ff2bd6)'
    }
};

AN.YEAR_LIST = [1980, 1981, 1982, 1983, 1984, 1985, 1986, 1987, 1988, 1989];

AN.POWERUPS = {
    double_points: { id: 'double_points', name: 'Double Points', icon: '×2', color: 0xffd60a, duration: 30 },
    speed_boost: { id: 'speed_boost', name: 'Speed Boost', icon: '⚡', color: 0x00f5ff, duration: 20 },
    time_freeze: { id: 'time_freeze', name: 'Time Freeze', icon: '⏸', color: 0xbb88ff, duration: 8 },
    streak_shield: { id: 'streak_shield', name: 'Streak Shield', icon: '🛡', color: 0x39ff14, duration: 0 },
    extra_life: { id: 'extra_life', name: 'Extra Life', icon: '♥', color: 0xff3366, duration: 0 },
    magnet: { id: 'magnet', name: 'Artifact Magnet', icon: '🧲', color: 0xff2bd6, duration: 25 }
};

AN.RANKS = [
    [0, 'TIME TOURIST'], [1200, 'DECADE EXPLORER'], [3500, 'NEON SCHOLAR'],
    [7000, 'SYNTHWAVE SAGE'], [12000, 'HISTORY HUNTER'], [20000, 'LEGEND OF THE 80s']
];

AN.TITLES = [
    { id: 'rookie', name: 'Rookie Traveler', req: 0 },
    { id: 'streak5', name: 'Hot Streak', req: 'streak5' },
    { id: 'perfect', name: 'Perfect Player', req: 'perfect_run' }
];

/** Simple trophies — each matches something real in the quiz */
AN.ACHIEVEMENTS = [
    { id: 'first_correct', name: 'First Try', desc: 'Get your first answer right' },
    { id: 'streak5', name: 'On Fire', desc: '5 correct answers in a row' },
    { id: 'journey_clear', name: 'Quiz Complete', desc: 'Finish a full 30-question run' },
    { id: 'perfect_run', name: 'Perfect Run', desc: 'Get every question right in one full run' },
    { id: 'bonus_win', name: 'Bonus Winner', desc: 'Win a bonus challenge mini-game' },
    { id: 'lifeline5050', name: 'Fifty-Fifty', desc: 'Use the 50/50 lifeline' },
    { id: 'first_upgrade', name: 'Power Up', desc: 'Buy your first upgrade with coins' },
    { id: 'high_score', name: 'High Scorer', desc: 'Score 150+ points in one run' }
];

/* [JUDGE] UPGRADES — bought with coins earned from completing runs + level-ups */
AN.UPGRADES = [
    { id: 'coin_mult', name: 'Coin Multiplier', icon: '🪙', desc: '+25% tokens every run', max: 5, cost: 50 },
    { id: 'extra_time', name: 'Time Boost', icon: '⏱', desc: '+2 seconds per question', max: 5, cost: 60 },
    { id: 'lucky_save', name: 'Lucky Save', icon: '🍀', desc: '30% chance to keep streak on miss', max: 3, cost: 100 },
    { id: 'eliminator', name: 'Answer Eliminator', icon: '✂️', desc: 'Remove 1 wrong answer each question', max: 3, cost: 80 },
    { id: 'xp_double', name: 'XP Amplifier', icon: '⚡', desc: '+30% XP earned', max: 5, cost: 75 }
];

AN.defaultSave = () => ({
    xp: 0, tokens: 0,
    journeys: 0, totalCorrect: 0, totalLifelines: 0, totalBonusWins: 0,
    bestScore: 0, bestStreak: 0,
    questionCursor: 0, adaptiveSkill: 0.35, seenQuestions: [],
    achievements: [], titles: ['rookie'],
    levelCursors: { easy: 0, medium: 0, hard: 0 },
    upgrades: { coin_mult: 0, extra_time: 0, lucky_save: 0, eliminator: 0, xp_double: 0 },
    shieldsLeft: 0
});

AN.upgradeLevel = (save, id) => save?.upgrades?.[id] || 0;

AN.normalizedTokens = (save) => Math.max(0, Math.floor(Number(save?.tokens) || 0));

AN.upgradeById = (id) => AN.UPGRADES.find(u => u.id === id);

AN.upgradePrice = (upgrade, level) => {
    if (!upgrade) return Infinity;
    const lv = Math.max(0, Math.floor(Number(level) || 0));
    return upgrade.cost + lv * 25;
};

AN.normalizeSave = (save) => {
    const base = AN.defaultSave();
    const merged = { ...base, ...(save || {}) };
    merged.tokens = AN.normalizedTokens(merged);
    merged.xp = Math.max(0, Math.floor(Number(merged.xp) || 0));
    merged.upgrades = { ...base.upgrades, ...(merged.upgrades || {}) };
    merged.levelCursors = { ...base.levelCursors, ...(merged.levelCursors || {}) };
    AN.UPGRADES.forEach(u => {
        const lv = Math.floor(Number(merged.upgrades[u.id]) || 0);
        merged.upgrades[u.id] = Math.max(0, Math.min(u.max, lv));
    });
    const validAch = new Set(AN.ACHIEVEMENTS.map(a => a.id));
    merged.achievements = Array.isArray(merged.achievements)
        ? merged.achievements.filter(id => validAch.has(id))
        : [];
    return merged;
};

AN.canBuyUpgrade = (save, id) => {
    const u = AN.upgradeById(id);
    if (!u || !save) return false;
    const lv = AN.upgradeLevel(save, id);
    if (lv >= u.max) return false;
    return AN.normalizedTokens(save) >= AN.upgradePrice(u, lv);
};

AN.triviaTimeLimit = (save) => AN.TRIVIA_TIME + AN.upgradeLevel(save, 'extra_time') * 2;

AN.coinMultiplier = (save) => 1 + AN.upgradeLevel(save, 'coin_mult') * 0.25;

AN.xpMultiplier = (save) => 1 + AN.upgradeLevel(save, 'xp_double') * 0.30;

AN.luckySaveChance = (save) => AN.upgradeLevel(save, 'lucky_save') * 0.30;

AN.eliminatorCount = (save) => Math.min(2, AN.upgradeLevel(save, 'eliminator'));

AN.difficultyScore = (d) => (d === 'hard' ? 1 : d === 'medium' ? 0.55 : 0.15);

/** Quiz difficulty tier: 1 easy · 2 medium · 3 hard */
AN.quizLevelNum = (diff) => {
    if (diff === 'hard') return 3;
    if (diff === 'medium') return 2;
    return 1;
};

AN.quizLevelLabel = (n) => ({ 1: 'EASY', 2: 'MEDIUM', 3: 'HARD' }[n] || 'QUIZ');

/** True when this question is the last in its difficulty tier before the next tier */
AN.isLastQuestionInLevel = (index, questions) => {
    const q = questions?.[index];
    const next = questions?.[index + 1];
    if (!q || !next) return false;
    return AN.quizLevelNum(q.difficulty) < AN.quizLevelNum(next.difficulty);
};

/** True when the next question starts a higher difficulty tier (2 or 3) */
AN.nextQuizLevelAfter = (index, questions) => {
    const q = questions?.[index];
    const next = questions?.[index + 1];
    if (!q || !next) return null;
    const cur = AN.quizLevelNum(q.difficulty);
    const nxt = AN.quizLevelNum(next.difficulty);
    return nxt > cur ? nxt : null;
};

/** If score is negative at end of a tier, player cannot enter the next round */
AN.quizLevelGateBlocks = (run) => {
    if (!run?.questions?.length) return null;
    const idx = run.stopIndex ?? 0;
    if (!AN.isLastQuestionInLevel(idx, run.questions)) return null;
    if ((run.score ?? 0) >= 0) return null;
    const next = run.questions[idx + 1];
    if (!next) return null;
    const completed = AN.quizLevelNum(run.questions[idx].difficulty);
    const blocked = AN.quizLevelNum(next.difficulty);
    return { completed, blocked, score: run.score };
};

AN.updateAdaptiveSkill = (save, correct) => {
    const s = save.adaptiveSkill ?? 0.35;
    save.adaptiveSkill = Math.max(0.1, Math.min(0.95, s + (correct ? 0.05 : -0.07)));
};

AN.markQuestionSeen = (save, questionId) => {
    if (!questionId) return;
    if (!save.seenQuestions) save.seenQuestions = [];
    if (!save.seenQuestions.includes(questionId)) {
        save.seenQuestions.push(questionId);
        if (save.seenQuestions.length > 200) save.seenQuestions.shift();
    }
};

AN.rankFor = (xp) => {
    let r = AN.RANKS[0][1];
    AN.RANKS.forEach(([n, name]) => { if (xp >= n) r = name; });
    return r;
};

AN.XP_PER_LEVEL = 400;
AN.XP_PER_CORRECT = 50;
AN.TOKENS_PER_LEVEL_UP = 15;
AN.TOKENS_PER_QUIZ_LEVEL = 30;

AN.levelFor = (xp) => Math.floor((xp || 0) / AN.XP_PER_LEVEL) + 1;

AN.xpProgress = (xp) => {
    const level = AN.levelFor(xp);
    const floor = (level - 1) * AN.XP_PER_LEVEL;
    const next = level * AN.XP_PER_LEVEL;
    const pct = next > floor ? ((xp - floor) / (next - floor)) * 100 : 100;
    return { level, pct: Math.min(100, Math.max(0, pct)), into: xp - floor, need: next - floor };
};

/* [JUDGE] LEVEL SYSTEM — 400 XP per profile level; +15 coins each level-up */
AN.addXp = (save, amount) => {
    const oldLevel = AN.levelFor(save.xp || 0);
    save.xp = (save.xp || 0) + Math.max(0, amount);
    const newLevel = AN.levelFor(save.xp);
    const levelsGained = Math.max(0, newLevel - oldLevel);
    let tokensGained = 0;
    if (levelsGained > 0) {
        tokensGained = levelsGained * AN.TOKENS_PER_LEVEL_UP;
        save.tokens = AN.normalizedTokens(save) + tokensGained;
    }
    return { oldLevel, newLevel, levelsGained, tokensGained };
};

AN.loadSave = () => {
    if (AN.Profiles?.loadSave) return AN.normalizeSave(AN.Profiles.loadSave());
    return AN.defaultSave();
};

AN.persist = (save) => {
    if (AN.Profiles?.persist) AN.Profiles.persist(save);
    AN.GlobalLB?.syncFromActive?.(save);
};

AN.yearForStop = (stopIndex) => AN.YEAR_LIST[stopIndex % AN.YEAR_LIST.length];

AN.sortedQuestionBank = (bank) => {
    const source = bank?.length ? bank : (AN.bank || []);
    return [...source].sort((a, b) => (a.order || 0) - (b.order || 0));
};

AN.pickJourneyQuestions = (bank, startIndex = 0) => {
    const sorted = AN.sortedQuestionBank(bank);
    if (!sorted.length) return [];
    const start = Math.max(0, Math.min(startIndex, sorted.length - 1));
    const out = [];
    for (let i = 0; i < AN.STOPS_PER_RUN; i++) {
        const q = sorted[(start + i) % sorted.length];
        if (q) out.push(q);
    }
    return out;
};

/* [JUDGE] ADAPTIVE DIFFICULTY — gets harder when you answer well, easier when you miss */
AN.pickFromDifficultyPool = (pool, count, save) => {
    if (!pool.length || count <= 0) return [];
    const skill = save?.adaptiveSkill ?? 0.35;
    const seen = new Set(save?.seenQuestions || []);
    const ranked = pool.map(q => {
        const diff = AN.difficultyScore(q.difficulty);
        let score = Math.abs(diff - skill);
        if (seen.has(q.id)) score += 0.2;
        score += Math.random() * 0.15;
        return { q, score };
    });
    ranked.sort((a, b) => a.score - b.score || (a.q.order || 0) - (b.q.order || 0));
    return ranked.slice(0, count).map(x => x.q);
};

/** Split bank into easy / medium / hard pools (sorted by question order) */
AN.buildDifficultyPools = (bank) => {
    const pools = { easy: [], medium: [], hard: [] };
    AN.sortedQuestionBank(bank).forEach(q => {
        const d = (q.difficulty || 'easy').toLowerCase();
        (pools[d] || pools.easy).push(q);
    });
    return pools;
};

/** Next N unique questions from a tier pool (no repeats within the run) */
AN.pickUniqueTierQuestions = (pool, count, cursor, usedIds) => {
    if (!pool?.length || count <= 0) return [];
    const len = pool.length;
    const start = ((Math.floor(cursor) % len) + len) % len;
    const out = [];
    for (let step = 0; step < len && out.length < count; step++) {
        const q = pool[(start + step) % len];
        if (!usedIds.has(q.id)) {
            out.push(q);
            usedIds.add(q.id);
        }
    }
    return out;
};

/** @deprecated — use pickUniqueTierQuestions */
AN.pickOrderedTier = (pool, count, cursor = 0) => {
    const used = new Set();
    return AN.pickUniqueTierQuestions(pool, count, cursor, used);
};

/** True when a run has the right tier order and no duplicate question IDs */
AN.isStructuredRunValid = (run) => {
    if (!run?.length) return false;
    const tiers = ['easy', 'medium', 'hard'];
    const used = new Set();
    let idx = 0;
    for (const tier of tiers) {
        const want = AN.RUN_LEVEL_COUNTS[tier] || 0;
        let got = 0;
        while (got < want && idx < run.length) {
            const q = run[idx++];
            if ((q.difficulty || 'easy').toLowerCase() !== tier) return false;
            if (used.has(q.id)) return false;
            used.add(q.id);
            got++;
        }
        if ((tier === 'easy' || tier === 'medium' || tier === 'hard') && got < want) return false;
    }
    return true;
};

/** Level 1: 10 easy → Level 2: 10 medium → Level 3: 10 hard (your 1980s bank, in order) */
AN.pickStructuredRun = (bank, save) => {
    const pools = AN.buildDifficultyPools(bank);
    if (!pools.easy.length && !pools.medium.length && !pools.hard.length) return [];
    if (!save.levelCursors) save.levelCursors = { easy: 0, medium: 0, hard: 0 };
    const usedIds = new Set();
    const out = [];
    for (const tier of ['easy', 'medium', 'hard']) {
        const want = AN.RUN_LEVEL_COUNTS[tier] || 0;
        const cur = save.levelCursors[tier] || 0;
        const tierPool = (pools[tier] || []).filter(
            q => (q.difficulty || 'easy').toLowerCase() === tier
        );
        out.push(...AN.pickUniqueTierQuestions(tierPool, want, cur, usedIds));
    }
    return out.slice(0, AN.STOPS_PER_RUN);
};

/** Call when a full run finishes — next run continues through the question bank */
AN.advanceLevelCursors = (save, bank, run) => {
    if (!save) return;
    const pools = AN.buildDifficultyPools(bank);
    if (!save.levelCursors) save.levelCursors = { easy: 0, medium: 0, hard: 0 };
    for (const tier of ['easy', 'medium', 'hard']) {
        const len = pools[tier]?.length || 0;
        if (!len) continue;
        const advanced = run
            ? run.filter(q => (q.difficulty || 'easy').toLowerCase() === tier).length
            : (AN.RUN_LEVEL_COUNTS[tier] || 0);
        if (advanced <= 0) continue;
        save.levelCursors[tier] = ((save.levelCursors[tier] || 0) + advanced) % len;
    }
};

AN.pickAdaptiveQuestions = (bank, save) => AN.pickStructuredRun(bank, save);

/** Load questions from bundled JS or questions.json in same folder as index.html */
AN.loadQuestionBank = () => {
    if (AN.QUESTION_BANK_JSON?.questions?.length) {
        AN.bank = AN.QUESTION_BANK_JSON.questions;
        return Promise.resolve();
    }
    const base = document.baseURI || window.location.href;
    const tryFile = (file) => fetch(new URL(file, base).href)
        .then(r => (r.ok ? r.json() : null))
        .then(d => { if (d?.questions?.length) AN.bank = d.questions; })
        .catch(() => {});
    return tryFile('questions.json').then(() => (AN.bank?.length ? null : tryFile('content/questions.json')));
};

AN.pointsFor = () => AN.SCORE_CORRECT;

AN.pointsForWrong = () => AN.SCORE_WRONG;
