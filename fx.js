/**
 * ═══════════════════════════════════════════════════════════════════════════
 * fx.js — SOUND & VISUAL EFFECTS (Presentation / Judge Guide)
 * ═══════════════════════════════════════════════════════════════════════════
 * Retro 1980s synth/arcade audio via Web Audio API + speech-friendly resume.
 * ═══════════════════════════════════════════════════════════════════════════
 */
window.AN = window.AN || {};
AN.FX = {};

let fxCtx, fxCanvas, particles = [];
let audioCtx, masterGain;

AN.FX._particlesOn = false;

AN.FX.setParticles = (on) => {
    AN.FX._particlesOn = !!on;
    if (!on) particles = [];
};

AN.FX.init = () => {
    fxCanvas = document.getElementById('fxCanvas');
    fxCtx = fxCanvas?.getContext('2d');
    AN.FX.resize();
    window.addEventListener('resize', () => AN.FX.resize());
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioCtx.createGain();
        masterGain.connect(audioCtx.destination);
        AN.FX._applyVolume();
    } catch (_) {}
    AN.A11y?.load?.();
    AN.A11y?.apply?.();
    const resume = () => AN.FX.resumeAudio();
    document.addEventListener('click', resume, { once: true });
    document.addEventListener('keydown', resume, { once: true });
    AN.FX.loop();
};

AN.FX.resumeAudio = () => {
    if (audioCtx?.state === 'suspended') audioCtx.resume();
};

AN.FX._out = () => masterGain || audioCtx?.destination;

AN.FX._applyVolume = () => {
    if (!masterGain) return;
    const s = AN.A11y?.get?.() || { volume: 0.7, muted: false };
    masterGain.gain.value = s.muted ? 0 : Math.max(0, Math.min(1, Number(s.volume) || 0.7));
};

AN.FX.setVolume = (v) => AN.A11y?.save?.({ volume: Math.max(0, Math.min(1, Number(v) || 0)) });

AN.FX.setMuted = (muted) => AN.A11y?.save?.({ muted: !!muted });

AN.FX.resize = () => {
    if (!fxCanvas) return;
    fxCanvas.width = innerWidth;
    fxCanvas.height = innerHeight;
};

/** Core oscillator beep — square/saw/sine for 8-bit feel */
AN.FX.beep = (freq, dur, type = 'square', vol = 0.08) => {
    if (!audioCtx) return;
    AN.FX.resumeAudio();
    const t0 = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g);
    g.connect(AN.FX._out());
    o.start(t0);
    o.stop(t0 + dur);
};

/** Frequency sweep — warp / whoosh */
AN.FX.sweep = (f0, f1, dur, type = 'sawtooth', vol = 0.06) => {
    if (!audioCtx) return;
    AN.FX.resumeAudio();
    const t0 = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g);
    g.connect(AN.FX._out());
    o.start(t0);
    o.stop(t0 + dur);
};

AN.FX.noiseBurst = (dur = 0.12, vol = 0.04) => {
    if (!audioCtx) return;
    AN.FX.resumeAudio();
    const t0 = audioCtx.currentTime;
    const len = Math.floor(audioCtx.sampleRate * dur);
    const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    const f = audioCtx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1200;
    src.connect(f);
    f.connect(g);
    g.connect(AN.FX._out());
    src.start(t0);
};

AN.FX.correct = () => {
    [523, 659, 784, 1047].forEach((f, i) => {
        setTimeout(() => AN.FX.beep(f, 0.09, 'square', 0.09), i * 55);
    });
    AN.FX.burst(innerWidth / 2, innerHeight / 2, 60, ['#ff2bd6', '#00f5ff', '#ffd54a']);
};

AN.FX.wrong = () => {
    AN.FX.sweep(220, 80, 0.35, 'sawtooth', 0.07);
    setTimeout(() => AN.FX.beep(110, 0.2, 'square', 0.05), 120);
};

AN.FX.levelUp = () => {
    [392, 494, 587, 784, 988].forEach((f, i) => {
        setTimeout(() => AN.FX.beep(f, 0.14, 'square', 0.1), i * 80);
    });
    AN.FX.burst(innerWidth / 2, innerHeight * 0.42, 90, ['#ffd54a', '#ff2bd6', '#00f5ff', '#fff']);
    const flash = document.getElementById('screenFlash');
    if (flash) {
        flash.className = 'ok';
        flash.classList.add('on', 'level-flash');
        setTimeout(() => flash.classList.remove('on', 'level-flash'), 280);
    }
};

AN.FX.jump = () => AN.FX.beep(440, 0.06, 'square', 0.05);

AN.FX.warp = () => {
    AN.FX.noiseBurst(0.15, 0.05);
    AN.FX.sweep(180, 880, 0.7, 'sawtooth', 0.05);
    setTimeout(() => AN.FX.beep(1320, 0.2, 'square', 0.06), 400);
};

AN.FX.commOpen = () => {
    AN.FX.noiseBurst(0.08, 0.03);
    [440, 554, 659].forEach((f, i) => {
        setTimeout(() => AN.FX.beep(f, 0.07, 'sine', 0.05), i * 70);
    });
};

AN.FX.typeBlip = () => {
    if (Math.random() > 0.35) return;
    AN.FX.beep(1200 + Math.random() * 400, 0.02, 'square', 0.015);
};

AN.FX.select = () => AN.FX.beep(660, 0.05, 'square', 0.06);

AN.FX.timerTick = () => AN.FX.beep(880, 0.04, 'square', 0.07);

AN.FX.coin = () => {
    AN.FX.beep(988, 0.06, 'square', 0.07);
    setTimeout(() => AN.FX.beep(1318, 0.1, 'square', 0.06), 50);
};

AN.FX.flash = (kind) => {
    const el = document.getElementById('screenFlash');
    el.className = kind || '';
    el.classList.add('on');
    setTimeout(() => el.classList.remove('on'), 80);
};

AN.FX.shake = (intensity = 1) => {
    const root = document.getElementById('shakeRoot');
    root.classList.remove('shake');
    void root.offsetWidth;
    root.style.setProperty('--shake', intensity);
    root.classList.add('shake');
};

AN.FX.burst = (x, y, n, colors) => {
    for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 2 + Math.random() * 6;
        particles.push({
            x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            life: 1, color: colors[i % colors.length], size: 2 + Math.random() * 4
        });
    }
};

AN.FX.floatScore = (text, x, y) => {
    const el = document.getElementById('floatScore');
    el.textContent = text;
    el.style.left = (x || innerWidth / 2) + 'px';
    el.style.top = (y || innerHeight / 3) + 'px';
    el.classList.remove('hidden');
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    setTimeout(() => el.classList.add('hidden'), 1000);
};

AN.FX.ambient = () => {
    if (Math.random() > 0.92) {
        particles.push({
            x: Math.random() * innerWidth, y: innerHeight + 10,
            vx: (Math.random() - 0.5) * 0.5, vy: -1 - Math.random() * 2,
            life: 1, color: Math.random() > 0.5 ? '#ff2bd6' : '#00f5ff', size: 1 + Math.random() * 2
        });
    }
};

AN.FX.loop = () => {
    requestAnimationFrame(AN.FX.loop);
    if (!fxCtx || !AN.FX._particlesOn) return;
    fxCtx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
    AN.FX.ambient();
    particles = particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        p.life -= 0.02;
        if (p.life <= 0) return false;
        fxCtx.globalAlpha = p.life;
        fxCtx.fillStyle = p.color;
        fxCtx.beginPath();
        fxCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        fxCtx.fill();
        return true;
    });
    fxCtx.globalAlpha = 1;
};
