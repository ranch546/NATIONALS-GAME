/* Device-wide accessibility settings — saved in localStorage */
window.AN = window.AN || {};
AN.A11y = {};

AN.A11y.STORAGE_KEY = 'journey1980s_a11y';

AN.A11y.defaults = () => ({
    bigButtons: false,
    colorBlind: false,
    showShortcuts: true,
    volume: 0.7,
    muted: false
});

AN.A11y.load = () => {
    if (AN.A11y._cache) return AN.A11y._cache;
    try {
        const raw = localStorage.getItem(AN.A11y.STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            AN.A11y._cache = { ...AN.A11y.defaults(), ...parsed };
            AN.A11y._cache.volume = Math.max(0, Math.min(1, Number(AN.A11y._cache.volume) || 0.7));
            return AN.A11y._cache;
        }
    } catch (_) {}
    AN.A11y._cache = AN.A11y.defaults();
    return AN.A11y._cache;
};

AN.A11y.get = () => AN.A11y.load();

AN.A11y.save = (patch) => {
    const next = { ...AN.A11y.get(), ...patch };
    next.volume = Math.max(0, Math.min(1, Number(next.volume) || 0));
    AN.A11y._cache = next;
    try {
        localStorage.setItem(AN.A11y.STORAGE_KEY, JSON.stringify(next));
    } catch (_) {}
    AN.A11y.apply();
    AN.FX?._applyVolume?.();
};

AN.A11y.apply = () => {
    const s = AN.A11y.get();
    const html = document.documentElement;
    html.classList.toggle('a11y-big-buttons', !!s.bigButtons);
    html.classList.toggle('a11y-colorblind', !!s.colorBlind);
    html.classList.toggle('a11y-show-shortcuts', !!s.showShortcuts);
    AN.UI?.syncA11yModal?.();
    AN.UI?.syncKeyboardHints?.();
};

AN.A11y.toggleMuted = () => {
    const s = AN.A11y.get();
    AN.A11y.save({ muted: !s.muted });
};

AN.A11y.init = () => {
    AN.A11y.load();
    AN.A11y.apply();
};
