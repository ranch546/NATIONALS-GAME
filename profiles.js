/**
 * ═══════════════════════════════════════════════════════════════════════════
 * profiles.js — MULTI-PLAYER SAVES (Presentation / Judge Guide)
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT IT DOES:
 *   Each player gets their own account on this device (localStorage).
 *   Stores: XP, coins, upgrades, best score, achievements separately.
 *
 * KEY FUNCTIONS:
 *   create()        — New player name + optional PIN
 *   login()         — Verify PIN and load that player's save
 *   loadSave()      — Read current player's progress
 *   persist()       — Write progress after each question / run
 *   leaderboard()   — Compare all players for the leaderboard screen
 *   delete()        — Remove account permanently
 * ═══════════════════════════════════════════════════════════════════════════
 */
/* Player profiles — each person gets their own saved progress (localStorage) */
window.AN = window.AN || {};
AN.Profiles = {};

AN.Profiles.STORAGE_KEY = 'journey1980s_profiles_v1';
AN.Profiles.LEGACY_KEY = 'journey1980s';
AN.Profiles.saveKey = (id) => 'journey1980s_player_' + id;

AN.Profiles._readRegistry = () => {
    try {
        const raw = localStorage.getItem(AN.Profiles.STORAGE_KEY);
        if (raw) return JSON.parse(raw);
    } catch (_) {}
    return { version: 1, activeId: null, profiles: [] };
};

AN.Profiles._writeRegistry = (reg) => {
    localStorage.setItem(AN.Profiles.STORAGE_KEY, JSON.stringify(reg));
};

AN.Profiles._migrateLegacy = () => {
    const reg = AN.Profiles._readRegistry();
    if (reg.profiles.length) return reg;
    try {
        const legacy = localStorage.getItem(AN.Profiles.LEGACY_KEY);
        if (!legacy) return reg;
        const id = 'p_legacy_' + Date.now().toString(36);
        const profile = {
            id,
            name: 'Player 1',
            pin: '',
            createdAt: Date.now(),
            lastPlayed: Date.now()
        };
        localStorage.setItem(AN.Profiles.saveKey(id), legacy);
        reg.profiles.push(profile);
        reg.activeId = id;
        AN.Profiles._writeRegistry(reg);
        localStorage.removeItem(AN.Profiles.LEGACY_KEY);
    } catch (_) {}
    return reg;
};

AN.Profiles.init = () => {
    AN.Profiles._migrateLegacy();
    const reg = AN.Profiles._readRegistry();
    let changed = false;
    reg.profiles.forEach(p => {
        if (!p.globalId) {
            p.globalId = 'g_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
            changed = true;
        }
    });
    if (changed) AN.Profiles._writeRegistry(reg);
    AN.GlobalLB?.syncAllLocal?.();
};

AN.Profiles.list = () => AN.Profiles._readRegistry().profiles;

AN.Profiles.getActiveId = () => AN.Profiles._readRegistry().activeId;

AN.Profiles.getActive = () => {
    const reg = AN.Profiles._readRegistry();
    return reg.profiles.find(p => p.id === reg.activeId) || null;
};

AN.Profiles.get = (id) => AN.Profiles.list().find(p => p.id === id) || null;

AN.Profiles._touch = (id) => {
    const reg = AN.Profiles._readRegistry();
    const p = reg.profiles.find(x => x.id === id);
    if (p) {
        p.lastPlayed = Date.now();
        AN.Profiles._writeRegistry(reg);
    }
};

AN.Profiles.setActive = (id) => {
    const reg = AN.Profiles._readRegistry();
    if (!reg.profiles.some(p => p.id === id)) return false;
    reg.activeId = id;
    AN.Profiles._writeRegistry(reg);
    AN.Profiles._touch(id);
    return true;
};

AN.Profiles.create = (name, pin = '') => {
    const trimmed = (name || '').trim();
    if (trimmed.length < 2 || trimmed.length > 18) return null;
    const reg = AN.Profiles._readRegistry();
    if (reg.profiles.some(p => p.name.toLowerCase() === trimmed.toLowerCase())) return null;
    const id = 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const profile = {
        id,
        name: trimmed,
        pin: String(pin || '').replace(/\D/g, '').slice(0, 4),
        globalId: 'g_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        createdAt: Date.now(),
        lastPlayed: Date.now()
    };
    reg.profiles.push(profile);
    reg.activeId = id;
    AN.Profiles._writeRegistry(reg);
    localStorage.setItem(AN.Profiles.saveKey(id), JSON.stringify(AN.defaultSave()));
    return profile;
};

AN.Profiles.checkPin = (id, pin) => {
    const p = AN.Profiles.get(id);
    if (!p) return false;
    if (!p.pin) return true;
    return String(pin || '') === p.pin;
};

AN.Profiles.login = (id, pin) => {
    if (!AN.Profiles.checkPin(id, pin)) return false;
    return AN.Profiles.setActive(id);
};

AN.Profiles.loadSave = () => {
    const id = AN.Profiles.getActiveId();
    if (!id) return AN.defaultSave();
    try {
        const s = localStorage.getItem(AN.Profiles.saveKey(id));
        if (s) return AN.normalizeSave(JSON.parse(s));
    } catch (_) {}
    return AN.defaultSave();
};

AN.Profiles.persist = (save) => {
    const id = AN.Profiles.getActiveId();
    if (!id) return;
    localStorage.setItem(AN.Profiles.saveKey(id), JSON.stringify(save));
    AN.Profiles._touch(id);
};

AN.Profiles._loadSaveFor = (id) => {
    let save = AN.defaultSave();
    try {
        const s = localStorage.getItem(AN.Profiles.saveKey(id));
        if (s) save = AN.normalizeSave(JSON.parse(s));
    } catch (_) {}
    return save;
};

AN.Profiles.summary = (id) => {
    const p = AN.Profiles.get(id);
    if (!p) return null;
    const save = AN.Profiles._loadSaveFor(id);
    return {
        profile: p,
        rank: AN.rankFor(save.xp),
        level: AN.levelFor(save.xp),
        xp: save.xp || 0,
        bestScore: save.bestScore || 0,
        bestStreak: save.bestStreak || 0,
        journeys: save.journeys || 0,
        tokens: save.tokens || 0,
        totalCorrect: save.totalCorrect || 0
    };
};

AN.Profiles.leaderboard = () => {
    const activeId = AN.Profiles.getActiveId();
    return AN.Profiles.list()
        .map(p => {
            const sum = AN.Profiles.summary(p.id);
            if (!sum) return null;
            return {
                id: p.id,
                name: p.name,
                xp: sum.xp,
                level: sum.level,
                rank: sum.rank,
                bestScore: sum.bestScore,
                bestStreak: sum.bestStreak,
                journeys: sum.journeys,
                totalCorrect: sum.totalCorrect,
                isActive: p.id === activeId
            };
        })
        .filter(Boolean)
        .sort((a, b) =>
            b.bestScore - a.bestScore
            || b.xp - a.xp
            || b.journeys - a.journeys
            || a.name.localeCompare(b.name));
};

AN.Profiles.delete = (id) => {
    const reg = AN.Profiles._readRegistry();
    reg.profiles = reg.profiles.filter(p => p.id !== id);
    if (reg.activeId === id) reg.activeId = reg.profiles[0]?.id || null;
    AN.Profiles._writeRegistry(reg);
    localStorage.removeItem(AN.Profiles.saveKey(id));
};
