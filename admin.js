/* Admin account — manage online users (Nationals / demo) */
window.AN = window.AN || {};
AN.Admin = {};

AN.Admin.USER_ID = 'admin';
AN.Admin.PASSWORD = 'chess1234';

AN.Admin.isAdminProfile = (profile) =>
    !!profile && (profile.isAdmin || profile.name?.toLowerCase() === AN.Admin.USER_ID);

AN.Admin.isActive = () => AN.Admin.isAdminProfile(AN.Profiles.getActive());

AN.Admin.checkPassword = (password) =>
    String(password || '') === AN.Admin.PASSWORD;

AN.Admin.ensureLocalAccount = () => {
    let admin = AN.Profiles.findByUserId(AN.Admin.USER_ID);
    if (admin) {
        if (!admin.isAdmin) {
            admin.isAdmin = true;
            const reg = AN.Profiles._readRegistry();
            const p = reg.profiles.find(x => x.id === admin.id);
            if (p) {
                p.isAdmin = true;
                AN.Profiles._writeRegistry(reg);
            }
        }
        return admin;
    }
    const reg = AN.Profiles._readRegistry();
    const id = 'p_admin_' + Date.now().toString(36);
    const profile = {
        id,
        name: AN.Admin.USER_ID,
        pin: '',
        isAdmin: true,
        globalId: 'g_admin_system',
        createdAt: Date.now(),
        lastPlayed: Date.now()
    };
    reg.profiles.push(profile);
    reg.activeId = id;
    AN.Profiles._writeRegistry(reg);
    AN.Profiles._setItem(AN.Profiles.saveKey(id), JSON.stringify(AN.defaultSave()));
    return profile;
};

AN.Admin.login = async (userId, password) => {
    if (!AN.Admin.checkPassword(password)) return { error: 'wrong_pin' };
    const profile = AN.Admin.ensureLocalAccount();
    AN.Profiles.setActive(profile.id);
    return { profile, admin: true };
};

AN.Admin.fetchAllRemoteUsers = async () => {
    if (!AN.GlobalLB?.isEnabled?.()) return [];
    try {
        const res = await fetch(AN.GlobalLB._userBase() + '.json');
        if (!res.ok) return [];
        const data = await res.json();
        if (!data || typeof data !== 'object') return [];
        return Object.entries(data)
            .map(([key, row]) => {
                if (!row || typeof row !== 'object') return null;
                const name = row.name || key;
                if (String(name).toLowerCase() === AN.Admin.USER_ID) return null;
                return {
                    key,
                    name: String(name),
                    globalId: row.globalId || '',
                    pinHash: row.pinHash || '',
                    updatedAt: row.updatedAt || 0
                };
            })
            .filter(Boolean)
            .sort((a, b) => a.name.localeCompare(b.name));
    } catch (_) {
        return [];
    }
};

AN.Admin.deleteRemoteUser = async (userId) => {
    if (!AN.GlobalLB?.isEnabled?.()) return { ok: false, error: 'offline' };
    const name = AN.Profiles.normalizeUserId(userId);
    if (!name || name.toLowerCase() === AN.Admin.USER_ID) return { ok: false, error: 'reserved' };
    if (AN.Demo?.isDemoName?.(name)) return { ok: false, error: 'protected' };
    const entry = await AN.GlobalLB.fetchUsernameEntry(name);
    if (!entry || entry.__error) return { ok: false, error: 'not_found' };
    const del = await AN.GlobalLB.forceDeleteUser(name);
    if (!del.ok) return del;
    const local = AN.Profiles.findByUserId(name);
    if (local) AN.Profiles.delete(local.id);
    return { ok: true };
};

AN.Admin.renameRemoteUser = async (oldName, newName) => {
    if (!AN.GlobalLB?.isEnabled?.()) return { ok: false, error: 'offline' };
    const oldTrim = AN.Profiles.normalizeUserId(oldName);
    const newTrim = AN.Profiles.normalizeUserId(newName);
    if (!oldTrim || !newTrim || newTrim.length < 2 || newTrim.length > 18) {
        return { ok: false, error: 'length' };
    }
    if (newTrim.toLowerCase() === AN.Admin.USER_ID) return { ok: false, error: 'reserved' };
    if (AN.Demo?.isDemoName?.(newTrim)) return { ok: false, error: 'reserved' };
    const taken = await AN.GlobalLB.isUserIdTakenRemote(newTrim);
    if (taken === null) return { ok: false, error: 'network' };
    if (taken) return { ok: false, error: 'taken' };
    const entry = await AN.GlobalLB.fetchUsernameEntry(oldTrim);
    if (!entry || entry.__error || !entry.globalId) return { ok: false, error: 'not_found' };
    const oldKey = AN.GlobalLB.userIdKey(oldTrim);
    const newKey = AN.GlobalLB.userIdKey(newTrim);
    const payload = { ...entry, name: newTrim, updatedAt: Date.now() };
    try {
        const putRes = await fetch(
            AN.GlobalLB._userBase() + '/' + encodeURIComponent(newKey) + '.json',
            { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
        );
        if (!putRes.ok) return { ok: false, error: 'network' };
        await fetch(AN.GlobalLB._userBase() + '/' + encodeURIComponent(oldKey) + '.json', { method: 'DELETE' });
        const local = AN.Profiles.findByUserId(oldTrim);
        if (local) {
            const reg = AN.Profiles._readRegistry();
            const p = reg.profiles.find(x => x.id === local.id);
            if (p) {
                p.name = newTrim;
                AN.Profiles._writeRegistry(reg);
            }
        }
        return { ok: true };
    } catch (_) {
        return { ok: false, error: 'network' };
    }
};

AN.Admin.setRemotePin = async (userId, newPin) => {
    if (!AN.GlobalLB?.isEnabled?.()) return { ok: false, error: 'offline' };
    const name = AN.Profiles.normalizeUserId(userId);
    const pinNorm = AN.Profiles._normalizePin(newPin);
    if (!AN.Profiles._isValidPin(pinNorm)) return { ok: false, error: 'pin' };
    const entry = await AN.GlobalLB.fetchUsernameEntry(name);
    if (!entry || entry.__error || !entry.globalId) return { ok: false, error: 'not_found' };
    const pinHash = await AN.Profiles._pinHash(pinNorm);
    const ok = await AN.GlobalLB.syncPinHash(name, entry.globalId, pinHash);
    const local = AN.Profiles.findByUserId(name);
    if (local) await AN.Profiles.setPin(local.id, pinNorm);
    return ok ? { ok: true } : { ok: false, error: 'network' };
};
