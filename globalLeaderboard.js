/* Global leaderboard — syncs best scores to Firebase Realtime Database */
window.AN = window.AN || {};
AN.GlobalLB = {};

AN.GlobalLB._cfg = () => window.AN_GLOBAL_LB || {};

AN.GlobalLB.isEnabled = () => {
    const url = (AN.GlobalLB._cfg().databaseURL || '').trim();
    return url.length > 12 && url.startsWith('https://') && !/YOUR-PROJECT/i.test(url);
};

AN.GlobalLB._base = () => {
    const url = (AN.GlobalLB._cfg().databaseURL || '').trim().replace(/\/$/, '');
    return url + '/leaderboard';
};

AN.GlobalLB._userBase = () => {
    const url = (AN.GlobalLB._cfg().databaseURL || '').trim().replace(/\/$/, '');
    return url + '/usernames';
};

AN.GlobalLB.userIdKey = (userId) =>
    AN.Profiles.normalizeUserId(userId).toLowerCase();

AN.GlobalLB.fetchUsernameEntry = async (userId) => {
    if (!AN.GlobalLB.isEnabled()) return null;
    const key = AN.GlobalLB.userIdKey(userId);
    if (!key) return null;
    try {
        const res = await fetch(AN.GlobalLB._userBase() + '/' + encodeURIComponent(key) + '.json');
        if (!res.ok) return { __error: true };
        const data = await res.json();
        if (data == null) return null;
        return data && typeof data === 'object' ? data : null;
    } catch (_) {
        return { __error: true };
    }
};

/** True = taken, false = free, null = could not check online */
AN.GlobalLB.isUserIdTakenRemote = async (userId, exceptGlobalId = null) => {
    const entry = await AN.GlobalLB.fetchUsernameEntry(userId);
    if (entry && entry.__error) return null;
    if (entry?.globalId && entry.globalId !== exceptGlobalId) return true;
    if (!AN.GlobalLB.isEnabled()) return false;
    const target = AN.GlobalLB.userIdKey(userId);
    if (!target) return false;
    try {
        const res = await fetch(AN.GlobalLB._base() + '.json');
        if (!res.ok) return entry ? false : null;
        const data = await res.json();
        if (!data || typeof data !== 'object') return false;
        const dup = Object.entries(data).some(([id, row]) => {
            if (!row || !row.name) return false;
            if (exceptGlobalId && id === exceptGlobalId) return false;
            return AN.GlobalLB.userIdKey(row.name) === target;
        });
        if (dup) return true;
    } catch (_) {
        return null;
    }
    return false;
};

/** Admin: delete User ID + all leaderboard rows for that name (no ownership check) */
AN.GlobalLB.forceDeleteUser = async (userId) => {
    if (!AN.GlobalLB.isEnabled()) return { ok: false, error: 'offline' };
    const name = AN.Profiles.normalizeUserId(userId);
    const key = AN.GlobalLB.userIdKey(name);
    if (!key) return { ok: false, error: 'invalid' };
    try {
        await fetch(AN.GlobalLB._userBase() + '/' + encodeURIComponent(key) + '.json', { method: 'DELETE' });
        const res = await fetch(AN.GlobalLB._base() + '.json');
        if (res.ok) {
            const data = await res.json();
            if (data && typeof data === 'object') {
                await Promise.all(Object.entries(data).map(async ([id, row]) => {
                    if (!row || typeof row !== 'object') return;
                    if (AN.GlobalLB.userIdKey(row.name || '') !== key) return;
                    await fetch(
                        AN.GlobalLB._base() + '/' + encodeURIComponent(id) + '.json',
                        { method: 'DELETE' }
                    );
                }));
            }
        }
        return { ok: true };
    } catch (_) {
        return { ok: false, error: 'network' };
    }
};

/** Reserve User ID globally — never wipe pinHash on update */
AN.GlobalLB.reserveUserId = async (userId, globalId, opts = {}) => {
    if (!AN.GlobalLB.isEnabled() || !globalId) return { status: 'ok' };
    const trimmed = AN.Profiles.normalizeUserId(userId);
    const key = AN.GlobalLB.userIdKey(trimmed);
    if (!key) return { status: 'error' };
    const existing = await AN.GlobalLB.fetchUsernameEntry(trimmed);
    if (existing && existing.__error) return { status: 'error' };
    if (existing?.globalId && existing.globalId !== globalId) return { status: 'taken' };
    const url = AN.GlobalLB._userBase() + '/' + encodeURIComponent(key) + '.json';
    const pinHash = opts.pinHash || existing?.pinHash || null;
    const payload = { name: trimmed, globalId, updatedAt: Date.now() };
    if (pinHash) payload.pinHash = pinHash;
    try {
        const res = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) return { status: 'error' };
        const verifyRes = await fetch(url);
        if (!verifyRes.ok) return { status: 'error' };
        const verify = await verifyRes.json();
        if (!verify || verify.globalId !== globalId) return { status: 'taken' };
        return { status: 'ok' };
    } catch (_) {
        return { status: 'error' };
    }
};

/** Sync raw PIN to cloud (hashes locally first) */
AN.GlobalLB.syncAccountCredentials = async (userId, globalId, pin) => {
    if (!AN.GlobalLB.isEnabled() || !globalId) return false;
    const pinHash = await AN.Profiles._pinHash(pin);
    if (!pinHash) return false;
    const result = await AN.GlobalLB.reserveUserId(userId, globalId, { pinHash });
    return result.status === 'ok';
};

/** PATCH account meta (PIN hash) when we own this User ID */
AN.GlobalLB.syncPinHash = async (userId, globalId, pinHash) => {
    if (!AN.GlobalLB.isEnabled() || !globalId || !pinHash) return false;
    const result = await AN.GlobalLB.reserveUserId(userId, globalId, { pinHash });
    return result.status === 'ok';
};

/** Reserve User ID globally (one per name worldwide) */
AN.GlobalLB.claimUserId = async (userId, globalId) => {
    const result = await AN.GlobalLB.reserveUserId(userId, globalId);
    return result.status === 'ok';
};

/** Free User ID when account is deleted (only if we own it) */
AN.GlobalLB.releaseUserId = async (userId, globalId) => {
    if (!AN.GlobalLB.isEnabled() || !globalId) return;
    const entry = await AN.GlobalLB.fetchUsernameEntry(userId);
    if (!entry || entry.__error || entry.globalId !== globalId) return;
    const key = AN.GlobalLB.userIdKey(userId);
    if (!key) return;
    try {
        await fetch(AN.GlobalLB._userBase() + '/' + encodeURIComponent(key) + '.json', { method: 'DELETE' });
    } catch (_) {}
};

AN.GlobalLB.clearAllUsers = async () => {
    if (!AN.GlobalLB.isEnabled()) return false;
    try {
        const res = await fetch(AN.GlobalLB._userBase() + '.json', { method: 'DELETE' });
        return res.ok;
    } catch (_) {
        return false;
    }
};

/** Wipe leaderboard + all registered User IDs when accountsResetVersion bumps */
AN.GlobalLB.ensureFreshAccounts = async () => {
    if (!AN.GlobalLB.isEnabled()) return;
    const ver = AN.GlobalLB._cfg().accountsResetVersion;
    if (!ver) return;
    const key = 'an_accounts_reset_v';
    if (localStorage.getItem(key) === String(ver)) return;
    try {
        await AN.GlobalLB.clearAllUsers();
        await fetch(AN.GlobalLB._base() + '.json', { method: 'DELETE' });
        localStorage.setItem(key, String(ver));
        localStorage.setItem(AN.GlobalLB._pinKey(), String(AN.GlobalLB._cfg().leaderboardResetVersion || ver));
    } catch (_) {}
};

AN.GlobalLB._pinKey = () => 'an_lb_reset_v';

/** Clears remote leaderboard once when leaderboardResetVersion bumps in firebase-config.js */
AN.GlobalLB.ensureFreshBoard = async () => {
    if (!AN.GlobalLB.isEnabled()) return;
    const ver = AN.GlobalLB._cfg().leaderboardResetVersion;
    if (!ver) return;
    if (localStorage.getItem(AN.GlobalLB._pinKey()) === String(ver)) return;
    try {
        await fetch(AN.GlobalLB._base() + '.json', { method: 'DELETE' });
        localStorage.setItem(AN.GlobalLB._pinKey(), String(ver));
    } catch (_) {}
};

AN.GlobalLB.clearRemote = async () => {
    if (!AN.GlobalLB.isEnabled()) return false;
    try {
        const res = await fetch(AN.GlobalLB._base() + '.json', { method: 'DELETE' });
        return res.ok;
    } catch (_) {
        return false;
    }
};

AN.GlobalLB._ensureGlobalId = (profile) => {
    if (!profile) return null;
    if (profile.globalId) return profile.globalId;
    profile.globalId = 'g_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const reg = AN.Profiles._readRegistry();
    const p = reg.profiles.find(x => x.id === profile.id);
    if (p) {
        p.globalId = profile.globalId;
        AN.Profiles._writeRegistry(reg);
    }
    return profile.globalId;
};

AN.GlobalLB._entryFromProfile = (profile, save) => {
    const sum = save ? {
        bestScore: save.bestScore || 0,
        bestStreak: save.bestStreak || 0,
        journeys: save.journeys || 0,
        xp: save.xp || 0
    } : AN.Profiles.summary(profile.id);
    if (!sum) return null;
    return {
        name: profile.name,
        bestScore: sum.bestScore || 0,
        bestStreak: sum.bestStreak || 0,
        journeys: sum.journeys || 0,
        xp: sum.xp || 0,
        rank: AN.rankFor(sum.xp || 0),
        level: AN.levelFor(sum.xp || 0),
        updatedAt: Date.now()
    };
};

AN.GlobalLB.syncProfile = async (profile, save) => {
    if (!AN.GlobalLB.isEnabled() || !profile) return;
    const key = AN.GlobalLB._ensureGlobalId(profile);
    if (!key) return;
    const entry = AN.GlobalLB._entryFromProfile(profile, save);
    if (!entry || entry.bestScore <= 0) return;
    try {
        const curRes = await fetch(AN.GlobalLB._base() + '/' + encodeURIComponent(key) + '.json');
        const cur = curRes.ok ? await curRes.json() : null;
        if (cur && (cur.bestScore || 0) >= entry.bestScore) return;
        await fetch(AN.GlobalLB._base() + '/' + encodeURIComponent(key) + '.json', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(entry)
        });
    } catch (_) {}
};

AN.GlobalLB.syncFromActive = (save) => {
    const profile = AN.Profiles.getActive();
    if (!profile || !save) return;
    AN.GlobalLB.syncProfile(profile, save);
};

AN.GlobalLB.syncAllLocal = () => {
    if (!AN.GlobalLB.isEnabled()) return;
    AN.Profiles.list().forEach(p => {
        const save = AN.Profiles._loadSaveFor(p.id);
        AN.GlobalLB.syncProfile(p, save);
    });
};

AN.GlobalLB.fetchRemote = async () => {
    if (!AN.GlobalLB.isEnabled()) return [];
    try {
        const res = await fetch(AN.GlobalLB._base() + '.json');
        if (!res.ok) return [];
        const data = await res.json();
        if (!data || typeof data !== 'object') return [];
        return Object.entries(data)
            .map(([id, row]) => {
                if (!row || !row.name) return null;
                return {
                    id,
                    name: String(row.name).slice(0, 18),
                    bestScore: Number(row.bestScore) || 0,
                    bestStreak: Number(row.bestStreak) || 0,
                    journeys: Number(row.journeys) || 0,
                    xp: Number(row.xp) || 0,
                    rank: row.rank || AN.rankFor(row.xp || 0),
                    level: row.level || AN.levelFor(row.xp || 0),
                    isActive: false,
                    isGlobal: true
                };
            })
            .filter(Boolean);
    } catch (_) {
        return [];
    }
};

AN.GlobalLB.getLeaderboard = async () => {
    const activeId = AN.Profiles.getActiveId();
    const activeProfile = AN.Profiles.getActive();
    const activeGlobalId = activeProfile ? AN.GlobalLB._ensureGlobalId(activeProfile) : null;

    if (!AN.GlobalLB.isEnabled()) {
        return AN.Profiles.leaderboard();
    }

    const remote = await AN.GlobalLB.fetchRemote();
    const byKey = new Map();

    remote.forEach(row => {
        byKey.set(row.id, row);
    });

    AN.Profiles.list().forEach(p => {
        const gid = AN.GlobalLB._ensureGlobalId(p);
        const sum = AN.Profiles.summary(p.id);
        if (!sum) return;
        const local = {
            id: gid,
            name: p.name,
            bestScore: sum.bestScore,
            bestStreak: sum.bestStreak,
            journeys: sum.journeys,
            xp: sum.xp,
            rank: sum.rank,
            level: sum.level,
            isActive: p.id === activeId,
            isGlobal: true
        };
        const existing = byKey.get(gid);
        if (!existing || local.bestScore > existing.bestScore) {
            byKey.set(gid, local);
        }
    });

    const byName = new Map();
    Array.from(byKey.values()).forEach(row => {
        const nk = AN.GlobalLB.userIdKey(row.name);
        const existing = byName.get(nk);
        if (!existing) {
            byName.set(nk, row);
            return;
        }
        const demoId = AN.Demo?.GLOBAL_ID;
        if (row.id === demoId) {
            byName.set(nk, row);
            return;
        }
        if (existing.id === demoId) return;
        if (row.bestScore > existing.bestScore
            || (row.bestScore === existing.bestScore && row.xp > existing.xp)) {
            byName.set(nk, row);
        }
    });

    return Array.from(byName.values()).sort((a, b) =>
        b.bestScore - a.bestScore
        || b.xp - a.xp
        || b.journeys - a.journeys
        || a.name.localeCompare(b.name));
};

AN.GlobalLB.statusText = () => {
    if (AN.GlobalLB.isEnabled()) return 'Worldwide — all players on every device';
    return 'Set up firebase-config.js for worldwide scores (see file comments)';
};
