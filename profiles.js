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

AN.Profiles.normalizeUserId = (userId) => String(userId || '').trim();

AN.Profiles.isUserIdTaken = (userId) => {
    const id = AN.Profiles.normalizeUserId(userId).toLowerCase();
    if (!id) return false;
    return AN.Profiles.list().some(p => p.name.toLowerCase() === id);
};

AN.Profiles.findByUserId = (userId) => {
    const id = AN.Profiles.normalizeUserId(userId).toLowerCase();
    if (!id) return null;
    return AN.Profiles.list().find(p => p.name.toLowerCase() === id) || null;
};

AN.Profiles._pinHash = async (pin) => {
    const pinNorm = AN.Profiles._normalizePin(pin);
    if (!AN.Profiles._isValidPin(pinNorm)) return '';
    const msg = 'journey1980s:' + pinNorm;
    if (typeof crypto !== 'undefined' && crypto.subtle) {
        try {
            const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(msg));
            return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (_) {}
    }
    let h = 5381;
    for (let i = 0; i < pinNorm.length; i++) h = ((h << 5) + h) ^ pinNorm.charCodeAt(i);
    return 'f' + (h >>> 0).toString(16);
};

AN.Profiles.storageOk = () => {
    if (AN.Profiles._storageOk != null) return AN.Profiles._storageOk;
    try {
        const k = '__journey1980s_storage_test__';
        localStorage.setItem(k, '1');
        localStorage.removeItem(k);
        AN.Profiles._storageOk = true;
    } catch (_) {
        AN.Profiles._storageOk = false;
    }
    return AN.Profiles._storageOk;
};

AN.Profiles._setItem = (key, value) => {
    if (!AN.Profiles.storageOk()) return false;
    try {
        localStorage.setItem(key, value);
        return localStorage.getItem(key) === value;
    } catch (_) {
        AN.Profiles._storageOk = false;
        return false;
    }
};

AN.Profiles._removeItem = (key) => {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (_) {
        return false;
    }
};

AN.Profiles._readRegistry = () => {
    try {
        const raw = localStorage.getItem(AN.Profiles.STORAGE_KEY);
        if (raw) return JSON.parse(raw);
    } catch (_) {}
    return { version: 1, activeId: null, profiles: [] };
};

AN.Profiles._writeRegistry = (reg) => {
    return AN.Profiles._setItem(AN.Profiles.STORAGE_KEY, JSON.stringify(reg));
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
        AN.Profiles._setItem(AN.Profiles.saveKey(id), legacy);
        reg.profiles.push(profile);
        reg.activeId = id;
        AN.Profiles._writeRegistry(reg);
        localStorage.removeItem(AN.Profiles.LEGACY_KEY);
    } catch (_) {}
    return reg;
};

AN.Profiles._normalizePin = (pin) => String(pin ?? '').replace(/\D/g, '').slice(0, 4);

AN.Profiles._profilePin = (p) => AN.Profiles._normalizePin(p?.pin);

AN.Profiles._hasValidPin = (p) => AN.Profiles._isValidPin(AN.Profiles._profilePin(p));

AN.Profiles._isValidPin = (pin) => AN.Profiles._normalizePin(pin).length === 4;

AN.Profiles._purgeNamedProfiles = (names) => {
    const reg = AN.Profiles._readRegistry();
    const lower = names.map(n => String(n).toLowerCase());
    const removeIds = reg.profiles.filter(p => lower.includes(p.name.toLowerCase())).map(p => p.id);
    if (!removeIds.length) return;
    removeIds.forEach(id => AN.Profiles._removeItem(AN.Profiles.saveKey(id)));
    reg.profiles = reg.profiles.filter(p => !removeIds.includes(p.id));
    if (reg.activeId && removeIds.includes(reg.activeId)) reg.activeId = reg.profiles[0]?.id || null;
    AN.Profiles._writeRegistry(reg);
};

AN.Profiles.wipeAllLocal = () => {
    const reg = AN.Profiles._readRegistry();
    reg.profiles.forEach(p => AN.Profiles._removeItem(AN.Profiles.saveKey(p.id)));
    AN.Profiles._writeRegistry({ version: 1, activeId: null, profiles: [] });
};

AN.Profiles.init = async () => {
    AN.Profiles._migrateLegacy();
    AN.Profiles.storageOk();
    await AN.GlobalLB?.ensureFreshAccounts?.();
    const wipeVer = AN.GlobalLB?._cfg?.()?.accountsResetVersion;
    const wipeKey = 'an_local_accounts_reset_v';
    if (wipeVer && localStorage.getItem(wipeKey) !== String(wipeVer)) {
        AN.Profiles.wipeAllLocal();
        localStorage.setItem(wipeKey, String(wipeVer));
    }
    AN.Admin?.ensureLocalAccount?.();
    const reg = AN.Profiles._readRegistry();
    let changed = false;
    reg.profiles.forEach(p => {
        if (!p.globalId) {
            p.globalId = 'g_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
            changed = true;
        }
        const pinNorm = AN.Profiles._profilePin(p);
        if (p.pin !== pinNorm) {
            p.pin = pinNorm;
            changed = true;
        }
    });
    if (changed) AN.Profiles._writeRegistry(reg);
    await AN.GlobalLB?.ensureFreshBoard?.();
    await AN.Profiles.syncUserIdsToCloud();
};

AN.Profiles.syncCredentialsToCloud = async (profile, pin) => {
    if (!profile?.globalId || AN.Admin?.isAdminProfile?.(profile)) return;
    if (!AN.GlobalLB?.isEnabled?.()) return;
    const pinNorm = AN.Profiles._normalizePin(pin ?? profile.pin);
    if (!AN.Profiles._isValidPin(pinNorm)) return;
    await AN.GlobalLB.syncAccountCredentials(profile.name, profile.globalId, pinNorm);
};

AN.Profiles.syncUserIdsToCloud = async () => {
    if (!AN.GlobalLB?.isEnabled?.()) return;
    for (const p of AN.Profiles.list()) {
        if (!p.globalId || AN.Admin?.isAdminProfile?.(p)) continue;
        if (AN.Profiles._hasValidPin(p)) {
            await AN.Profiles.syncCredentialsToCloud(p);
        } else {
            await AN.GlobalLB.reserveUserId(p.name, p.globalId);
        }
    }
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

AN.Profiles.create = async (userId, pin = '') => {
    if (!AN.Profiles.storageOk()) return { error: 'storage' };
    const trimmed = AN.Profiles.normalizeUserId(userId);
    const pinNorm = AN.Profiles._normalizePin(pin);
    if (trimmed.length < 2 || trimmed.length > 18) return { error: 'length' };
    if (trimmed.toLowerCase() === AN.Admin?.USER_ID) {
        return { error: 'reserved', userId: trimmed };
    }
    if (!AN.Profiles._isValidPin(pinNorm)) return { error: 'pin' };
    if (AN.Profiles.isUserIdTaken(trimmed)) {
        return { error: 'duplicate', userId: trimmed, global: false };
    }
    const globalId = 'g_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const pinHash = await AN.Profiles._pinHash(pinNorm);
    if (AN.GlobalLB?.isEnabled?.()) {
        const remote = await AN.GlobalLB.reserveUserId(trimmed, globalId, { pinHash });
        if (remote.status === 'taken') {
            return { error: 'duplicate', userId: trimmed, global: true };
        }
        if (remote.status === 'error') {
            return { error: 'network' };
        }
    }
    const reg = AN.Profiles._readRegistry();
    const id = 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const profile = {
        id,
        name: trimmed,
        pin: pinNorm,
        globalId,
        createdAt: Date.now(),
        lastPlayed: Date.now()
    };
    reg.profiles.push(profile);
    reg.activeId = id;
    if (!AN.Profiles._writeRegistry(reg)) {
        if (AN.GlobalLB?.isEnabled?.()) AN.GlobalLB.releaseUserId(trimmed, globalId);
        return { error: 'storage' };
    }
    const saveJson = JSON.stringify(AN.defaultSave());
    if (!AN.Profiles._setItem(AN.Profiles.saveKey(id), saveJson)) {
        reg.profiles = reg.profiles.filter(p => p.id !== id);
        reg.activeId = reg.profiles[0]?.id || null;
        AN.Profiles._writeRegistry(reg);
        if (AN.GlobalLB?.isEnabled?.()) AN.GlobalLB.releaseUserId(trimmed, globalId);
        return { error: 'storage' };
    }
    return { profile };
};

AN.Profiles.setPin = async (id, pin) => {
    const pinNorm = AN.Profiles._normalizePin(pin);
    if (!AN.Profiles._isValidPin(pinNorm)) return false;
    const reg = AN.Profiles._readRegistry();
    const p = reg.profiles.find(x => x.id === id);
    if (!p) return false;
    p.pin = pinNorm;
    AN.Profiles._writeRegistry(reg);
    if (AN.GlobalLB?.isEnabled?.() && p.globalId) {
        await AN.Profiles.syncCredentialsToCloud(p, pinNorm);
    }
    return true;
};

AN.Profiles.checkPin = (id, pin) => {
    const p = AN.Profiles.get(id);
    const stored = AN.Profiles._profilePin(p);
    if (!p || !AN.Profiles._isValidPin(stored)) return false;
    return AN.Profiles._normalizePin(pin) === stored;
};

AN.Profiles.login = (id, pin) => {
    if (!AN.Profiles.checkPin(id, pin)) return false;
    return AN.Profiles.setActive(id);
};

AN.Profiles.loginByUserId = async (userId, pin) => {
    const trimmed = AN.Profiles.normalizeUserId(userId);
    if (trimmed.toLowerCase() === AN.Admin?.USER_ID) {
        return AN.Admin.login(trimmed, pin);
    }
    const pinNorm = AN.Profiles._normalizePin(pin);
    if (trimmed.length < 2) return { error: 'length' };
    if (!AN.Profiles._isValidPin(pinNorm)) return { error: 'pin' };

    const local = AN.Profiles.findByUserId(trimmed);
    if (local) {
        if (!AN.Profiles._hasValidPin(local)) {
            return { error: 'needs_setup', profileId: local.id, userId: trimmed };
        }
        if (!AN.Profiles.checkPin(local.id, pinNorm)) return { error: 'wrong_pin' };
        AN.Profiles.setActive(local.id);
        await AN.Profiles.syncCredentialsToCloud(local, pinNorm);
        return { profile: local };
    }

    if (!AN.GlobalLB?.isEnabled?.()) return { error: 'not_found' };

    const entry = await AN.GlobalLB.fetchUsernameEntry(trimmed);
    if (entry && entry.__error) return { error: 'network' };
    if (!entry || !entry.globalId) return { error: 'not_found' };

    const pinHash = await AN.Profiles._pinHash(pinNorm);
    if (entry.pinHash && entry.pinHash !== pinHash) return { error: 'wrong_pin' };

    if (!AN.Profiles.storageOk()) return { error: 'storage' };

    const reg = AN.Profiles._readRegistry();
    const id = 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const profile = {
        id,
        name: trimmed,
        pin: pinNorm,
        globalId: entry.globalId,
        createdAt: Date.now(),
        lastPlayed: Date.now()
    };
    reg.profiles.push(profile);
    reg.activeId = id;
    if (!AN.Profiles._writeRegistry(reg)) return { error: 'storage' };
    const saveJson = JSON.stringify(AN.defaultSave());
    if (!AN.Profiles._setItem(AN.Profiles.saveKey(id), saveJson)) {
        reg.profiles = reg.profiles.filter(p => p.id !== id);
        reg.activeId = reg.profiles[0]?.id || null;
        AN.Profiles._writeRegistry(reg);
        return { error: 'storage' };
    }
    await AN.GlobalLB.syncAccountCredentials(trimmed, entry.globalId, pinNorm);
    return { profile, restored: true };
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
    if (!id || !save) return false;
    const ok = AN.Profiles._setItem(AN.Profiles.saveKey(id), JSON.stringify(save));
    if (ok) AN.Profiles._touch(id);
    return ok;
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
    const p = AN.Profiles.get(id);
    const reg = AN.Profiles._readRegistry();
    reg.profiles = reg.profiles.filter(x => x.id !== id);
    if (reg.activeId === id) reg.activeId = reg.profiles[0]?.id || null;
    AN.Profiles._writeRegistry(reg);
    AN.Profiles._removeItem(AN.Profiles.saveKey(id));
    if (p && AN.GlobalLB?.isEnabled?.()) {
        AN.GlobalLB.releaseUserId(p.name, p.globalId);
    }
};
