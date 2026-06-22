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

    return Array.from(byKey.values()).sort((a, b) =>
        b.bestScore - a.bestScore
        || b.xp - a.xp
        || b.journeys - a.journeys
        || a.name.localeCompare(b.name));
};

AN.GlobalLB.statusText = () => {
    if (AN.GlobalLB.isEnabled()) return 'Worldwide — all players on every device';
    return 'Set up firebase-config.js for worldwide scores (see file comments)';
};
