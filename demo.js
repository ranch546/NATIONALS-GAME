/* Judge Demo Mode — protected showcase account for presentations */
window.AN = window.AN || {};
AN.Demo = {};

AN.Demo.NAME = 'Judge Demo Mode';
AN.Demo.GLOBAL_ID = 'g_judge_demo_mode';
AN.Demo.PIN = '1234';

AN.Demo.isDemoName = (userId) =>
    AN.Profiles.normalizeUserId(userId).toLowerCase() === AN.Demo.NAME.toLowerCase();

AN.Demo.save = () => {
    const s = AN.defaultSave();
    s.xp = 4000;
    s.bestScore = 1985;
    s.bestStreak = 12;
    s.journeys = 8;
    s.totalCorrect = 150;
    s.totalQuestionsAnswered = 90;
    s.tokens = 240;
    return s;
};

AN.Demo.leaderboardEntry = () => ({
    name: AN.Demo.NAME,
    bestScore: 1985,
    bestStreak: 12,
    journeys: 8,
    xp: 4000,
    rank: 'NEON SCHOLAR',
    level: 11,
    updatedAt: Date.now(),
    isDemo: true
});

/** Remove duplicate leaderboard rows that share the demo name but wrong globalId */
AN.Demo.purgeDuplicateLeaderboardRows = async () => {
    if (!AN.GlobalLB?.isEnabled?.()) return;
    try {
        const res = await fetch(AN.GlobalLB._base() + '.json');
        if (!res.ok) return;
        const data = await res.json();
        if (!data || typeof data !== 'object') return;
        const target = AN.GlobalLB.userIdKey(AN.Demo.NAME);
        await Promise.all(Object.entries(data).map(async ([id, row]) => {
            if (!row || typeof row !== 'object') return;
            const rowKey = AN.GlobalLB.userIdKey(row.name || '');
            if (rowKey === target && id !== AN.Demo.GLOBAL_ID) {
                await fetch(
                    AN.GlobalLB._base() + '/' + encodeURIComponent(id) + '.json',
                    { method: 'DELETE' }
                );
            }
        }));
    } catch (_) {}
};

/** Ensure one canonical Judge Demo Mode online (score 1985 · LV 11) */
AN.Demo.ensureOnline = async () => {
    if (!AN.GlobalLB?.isEnabled?.()) return;
    await AN.Demo.purgeDuplicateLeaderboardRows();
    const pinHash = await AN.Profiles._pinHash(AN.Demo.PIN);
    await AN.GlobalLB.reserveUserId(AN.Demo.NAME, AN.Demo.GLOBAL_ID, { pinHash, protected: true });
    try {
        await fetch(
            AN.GlobalLB._base() + '/' + encodeURIComponent(AN.Demo.GLOBAL_ID) + '.json',
            {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(AN.Demo.leaderboardEntry())
            }
        );
    } catch (_) {}
};

AN.Demo.ensureLocal = () => {
    const reg = AN.Profiles._readRegistry();
    const demos = reg.profiles.filter(p => AN.Demo.isDemoName(p.name));
    if (demos.length > 1) {
        const keeper = demos.find(p => p.globalId === AN.Demo.GLOBAL_ID) || demos[0];
        demos.filter(p => p.id !== keeper.id).forEach(p => {
            AN.Profiles._removeItem(AN.Profiles.saveKey(p.id));
        });
        reg.profiles = reg.profiles.filter(p => !AN.Demo.isDemoName(p.name) || p.id === keeper.id);
        AN.Profiles._writeRegistry(reg);
    }
    let p = AN.Profiles.findByUserId(AN.Demo.NAME);
    if (!p) {
        const reg = AN.Profiles._readRegistry();
        const id = 'p_judge_demo';
        p = {
            id,
            name: AN.Demo.NAME,
            pin: AN.Demo.PIN,
            globalId: AN.Demo.GLOBAL_ID,
            isDemo: true,
            createdAt: Date.now(),
            lastPlayed: Date.now()
        };
        reg.profiles.push(p);
        AN.Profiles._writeRegistry(reg);
        AN.Profiles._setItem(AN.Profiles.saveKey(id), JSON.stringify(AN.Demo.save()));
    } else {
        p.globalId = AN.Demo.GLOBAL_ID;
        AN.Profiles._setItem(AN.Profiles.saveKey(p.id), JSON.stringify(AN.Demo.save()));
        const reg = AN.Profiles._readRegistry();
        const row = reg.profiles.find(x => x.id === p.id);
        if (row) {
            row.globalId = AN.Demo.GLOBAL_ID;
            row.pin = AN.Demo.PIN;
            row.isDemo = true;
            AN.Profiles._writeRegistry(reg);
        }
    }
    return p;
};

AN.Demo.ensure = async () => {
    AN.Demo.ensureLocal();
    await AN.Demo.ensureOnline();
};
