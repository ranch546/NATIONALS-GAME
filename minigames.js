/**
 * ═══════════════════════════════════════════════════════════════════════════
 * minigames.js — LIFELINE MINI-GAMES (Presentation / Judge Guide)
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT IT DOES:
 *   After a CORRECT answer, player can play a bonus mini-game.
 *   Win = +1 heart (up to max). Lose = no penalty, just continue.
 *
 * 10 GAMES: Reaction, Memory, Whack-a-Mole, Simon, Typing, Math,
 *           Sprint, Pac-Man, Pattern, Decoder (picked at random)
 *
 * KEY FUNCTION: start(callback) — runs one game, calls back true/false
 * ═══════════════════════════════════════════════════════════════════════════
 */
/* Lifeline mini-games — win = +1 heart */
window.AN = window.AN || {};
AN.Minigames = {};

AN.Minigames._area = () => document.getElementById('mgArea');
AN.Minigames._timer = () => document.getElementById('mgTimer');
AN.Minigames._hint = () => document.getElementById('mgHint');
AN.Minigames._title = () => document.getElementById('mgTitle');
AN.Minigames._cleanup = null;

AN.Minigames._done = (won, cb) => {
    if (AN.Minigames._cleanup) { AN.Minigames._cleanup(); AN.Minigames._cleanup = null; }
    cb(!!won);
};

AN.Minigames._countdown = (sec, onTick, onEnd) => {
    let t = sec;
    const el = AN.Minigames._timer();
    if (el) el.textContent = t + 's';
    const iv = setInterval(() => {
        t--;
        if (el) el.textContent = t + 's';
        if (onTick) onTick(t);
        if (t <= 0) { clearInterval(iv); onEnd(); }
    }, 1000);
    AN.Minigames._cleanup = () => clearInterval(iv);
    return iv;
};

AN.Minigames.GAMES = [
    { id: 'reaction', name: 'Reaction Test', icon: '🟢' },
    { id: 'memory', name: 'Memory Match', icon: '🃏' },
    { id: 'whack', name: 'Whack-a-Mole', icon: '🔨' },
    { id: 'simon', name: 'Simon Says', icon: '💡' },
    { id: 'typing', name: 'Fast Typing', icon: '⌨️' },
    { id: 'math', name: 'Number Crunch', icon: '🔢' },
    { id: 'sprint', name: 'Olympic Sprint', icon: '🏃' },
    { id: 'pacman', name: 'Pac-Man Chase', icon: '👾' },
    { id: 'pattern', name: 'Pattern Builder', icon: '🎨' },
    { id: 'decoder', name: 'Cold War Decoder', icon: '🔐' }
];

AN.Minigames.start = (onComplete) => {
    const g = AN.Minigames.GAMES[Math.floor(Math.random() * AN.Minigames.GAMES.length)];
    AN.Minigames._title().textContent = g.icon + ' ' + g.name.toUpperCase();
    AN.Minigames._hint().textContent = 'Win for +1 ♥!';
    AN.Minigames[g.id](onComplete);
};

/* 1. Reaction — click when green */
AN.Minigames.reaction = (cb) => {
    const area = AN.Minigames._area();
    area.innerHTML = '<div id="mgReact" class="mg-react mg-wait">WAIT…</div>';
    const el = document.getElementById('mgReact');
    let done = false;
    const finish = w => { if (done) return; done = true; AN.Minigames._done(w, cb); };
    const delay = 1500 + Math.random() * 2500;
    const to = setTimeout(() => {
        el.className = 'mg-react mg-go';
        el.textContent = 'CLICK NOW!';
        const start = performance.now();
        el.onclick = () => {
            const ms = performance.now() - start;
            finish(ms < 600);
        };
    }, delay);
    el.onclick = () => { if (el.classList.contains('mg-wait')) finish(false); };
    AN.Minigames._countdown(6, null, () => finish(false));
    const prevCleanup = AN.Minigames._cleanup;
    AN.Minigames._cleanup = () => {
        clearTimeout(to);
        el.onclick = null;
        if (prevCleanup) prevCleanup();
    };
};

/* 2. Memory — find matching pair (4 cards, 2 identical) */
AN.Minigames.memory = (cb) => {
    const icons = ['📼', '🕹️', '📻', '🏀'];
    const pair = icons[Math.floor(Math.random() * icons.length)];
    const others = icons.filter((x) => x !== pair);
    const cards = [pair, pair, others[0], others[1]].sort(() => Math.random() - 0.5);
    const area = AN.Minigames._area();
    if (!area) { cb(false); return; }

    area.innerHTML = '<div class="mg-memory">' + cards.map((c, i) =>
        `<button type="button" class="mg-card" data-i="${i}" data-v="${c}">?</button>`).join('') + '</div>';

    const grid = area.querySelector('.mg-memory');
    const buttons = () => grid.querySelectorAll('.mg-card');

    let first = null;
    let locked = false;
    let matched = false;
    let done = false;
    let flipTimer = null;

    const setLocked = (on) => {
        locked = on;
        buttons().forEach((b) => {
            if (!b.classList.contains('gone')) b.disabled = on;
        });
    };

    const closeCard = (btn) => {
        if (!btn || btn.classList.contains('gone')) return;
        btn.classList.remove('open');
        btn.textContent = '?';
        btn.disabled = false;
    };

    const openCard = (btn) => {
        btn.classList.add('open');
        btn.textContent = btn.dataset.v;
    };

    const finish = (w) => {
        if (done) return;
        done = true;
        if (flipTimer) { clearTimeout(flipTimer); flipTimer = null; }
        first = null;
        locked = false;
        buttons().forEach((b) => { b.onclick = null; b.disabled = true; });
        AN.Minigames._done(w, cb);
    };

    const onCardClick = (btn) => {
        if (done || locked) return;
        if (!btn || btn.classList.contains('gone') || btn.classList.contains('open')) return;

        openCard(btn);

        if (!first) {
            first = btn;
            return;
        }

        if (btn === first) return;

        setLocked(true);

        if (first.dataset.v === btn.dataset.v) {
            first.classList.add('gone');
            btn.classList.add('gone');
            first = null;
            matched = true;
            setLocked(false);
            finish(true);
            return;
        }

        const a = first;
        const b = btn;
        first = null;
        flipTimer = setTimeout(() => {
            flipTimer = null;
            closeCard(a);
            closeCard(b);
            setLocked(false);
        }, 650);
    };

    buttons().forEach((btn) => {
        btn.onclick = () => onCardClick(btn);
    });

    AN.Minigames._countdown(15, null, () => finish(matched));
    const prevCleanup = AN.Minigames._cleanup;
    AN.Minigames._cleanup = () => {
        if (flipTimer) clearTimeout(flipTimer);
        buttons().forEach((b) => { b.onclick = null; });
        if (prevCleanup) prevCleanup();
    };
};

/* 3. Whack-a-Mole */
AN.Minigames.whack = (cb) => {
    const items = ['📼', '📻', '🧩', '🕹️'];
    const area = AN.Minigames._area();
    area.innerHTML = '<div class="mg-whack">' + Array(9).fill(0).map((_, i) =>
        `<button type="button" class="mg-hole" data-i="${i}"></button>`).join('') + '</div><p class="mg-score-txt">Hits: <span id="mgHits">0</span>/8</p>';
    let hits = 0, done = false;
    const finish = w => { if (done) return; done = true; clearInterval(spawn); AN.Minigames._done(w, cb); };
    const holes = area.querySelectorAll('.mg-hole');
    const pop = () => {
        holes.forEach(h => { h.textContent = ''; h.classList.remove('up'); });
        const h = holes[Math.floor(Math.random() * 9)];
        h.textContent = items[Math.floor(Math.random() * items.length)];
        h.classList.add('up');
    };
    holes.forEach(h => {
        h.onclick = () => {
            if (!h.classList.contains('up') || done) return;
            h.classList.remove('up'); h.textContent = '';
            hits++;
            document.getElementById('mgHits').textContent = hits;
            if (hits >= 8) finish(true);
        };
    });
    const spawn = setInterval(pop, 700);
    pop();
    AN.Minigames._countdown(14, null, () => finish(hits >= 8));
    const old = AN.Minigames._cleanup;
    AN.Minigames._cleanup = () => { clearInterval(spawn); if (old) old(); };
};

/* 4. Simon Says */
AN.Minigames.simon = (cb) => {
    const cols = ['#e63946', '#00b4d8', '#ffd60a', '#2dc653'];
    const area = AN.Minigames._area();
    area.innerHTML = '<div class="mg-simon">' + cols.map((c, i) =>
        `<button type="button" class="mg-pad" data-i="${i}" style="background:${c}"></button>`).join('') + '</div>';
    const seq = Array.from({ length: 4 }, () => Math.floor(Math.random() * 4));
    let step = 0, input = 0, done = false;
    const finish = w => { if (done) return; done = true; AN.Minigames._done(w, cb); };
    const pads = area.querySelectorAll('.mg-pad');
    const flash = i => {
        pads[i].classList.add('lit');
        setTimeout(() => pads[i].classList.remove('lit'), 400);
    };
    let si = 0;
    const showSeq = () => {
        if (si >= seq.length) { input = 0; return; }
        flash(seq[si++]);
        setTimeout(showSeq, 550);
    };
    setTimeout(showSeq, 800);
    pads.forEach(p => {
        p.onclick = () => {
            if (input >= seq.length || done) return;
            const i = parseInt(p.dataset.i, 10);
            flash(i);
            if (i !== seq[input]) { finish(false); return; }
            input++;
            if (input >= seq.length) finish(true);
        };
    });
    AN.Minigames._countdown(15, null, () => finish(false));
};

AN.Minigames._scrambleWord = (word) => {
    const chars = word.split('');
    let out = word;
    for (let attempt = 0; attempt < 12 && out === word; attempt++) {
        for (let i = chars.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [chars[i], chars[j]] = [chars[j], chars[i]];
        }
        out = chars.join('');
    }
    return out === word ? [...word].reverse().join('') : out;
};

/* 5. Fast Typing — longer 1980s words, tighter timer */
AN.Minigames.typing = (cb) => {
    const words = ['COMMODORE', 'CHALLENGER', 'GORBACHEV', 'BERLINWALL', 'WALKMAN', 'NINTENDO', 'SOLIDARITY', 'CHERNOBYL'];
    const word = words[Math.floor(Math.random() * words.length)];
    const area = AN.Minigames._area();
    area.innerHTML = `<p class="mg-type-word">${word}</p><p class="mg-sprint-hint">${word.length} letters · type fast!</p><input type="text" class="mg-input" id="mgTypeIn" autocomplete="off" placeholder="Type here…" />`;
    const inp = document.getElementById('mgTypeIn');
    let done = false;
    const finish = w => { if (done) return; done = true; AN.Minigames._done(w, cb); };
    inp.oninput = () => { if (inp.value.toUpperCase() === word) finish(true); };
    inp.onpaste = (e) => e.preventDefault();
    setTimeout(() => inp.focus(), 100);
    AN.Minigames._countdown(6, null, () => finish(inp.value.toUpperCase() === word));
};

/* 6. Number Crunch */
AN.Minigames.math = (cb) => {
    const a = 5 + Math.floor(Math.random() * 15);
    const b = 3 + Math.floor(Math.random() * 12);
    const area = AN.Minigames._area();
    area.innerHTML = `<p class="mg-math-q">${a} + ${b} = ?</p><input type="number" class="mg-input" id="mgMathIn" />`;
    const inp = document.getElementById('mgMathIn');
    let done = false;
    const finish = w => { if (done) return; done = true; AN.Minigames._done(w, cb); };
    inp.oninput = () => { if (parseInt(inp.value, 10) === a + b) finish(true); };
    setTimeout(() => inp.focus(), 100);
    AN.Minigames._countdown(7, null, () => finish(parseInt(inp.value, 10) === a + b));
};

/* 7. Olympic Sprint — mash SPACE */
AN.Minigames.sprint = (cb) => {
    const area = AN.Minigames._area();
    area.innerHTML = '<p class="mg-sprint-hint">MASH SPACE or CLICK!</p><div class="mg-sprint-bar"><div id="mgSprintFill"></div></div>';
    const fill = document.getElementById('mgSprintFill');
    let prog = 0, done = false;
    const finish = w => { if (done) return; done = true; AN.Minigames._done(w, cb); };
    const boost = () => {
        prog = Math.min(100, prog + 8);
        fill.style.width = prog + '%';
        if (prog >= 100) finish(true);
    };
    const keyFn = e => { if (e.code === 'Space') { e.preventDefault(); boost(); } };
    const clickFn = () => boost();
    addEventListener('keydown', keyFn);
    area.addEventListener('click', clickFn);
    AN.Minigames._countdown(6, null, () => finish(prog >= 100));
    AN.Minigames._cleanup = () => { removeEventListener('keydown', keyFn); area.removeEventListener('click', clickFn); };
};

/* 8. Pac-Man Chase — collect pellets (keyboard + mobile D-pad / swipe) */
AN.Minigames.pacman = (cb) => {
    const area = AN.Minigames._area();
    if (!area) { cb(false); return; }

    area.innerHTML = `
        <div class="mg-pac-wrap">
            <canvas id="mgPac" class="mg-canvas"></canvas>
            <p class="mg-score-txt">Pellets: <span id="mgPel">0</span>/10</p>
            <p class="mg-pac-hint">Tap arrows or swipe on the maze</p>
            <div class="mg-pac-pad" id="mgPacPad" aria-label="Move controls">
                <button type="button" class="mg-pac-btn mg-pac-up" data-dir="up" aria-label="Up">▲</button>
                <button type="button" class="mg-pac-btn mg-pac-left" data-dir="left" aria-label="Left">◀</button>
                <button type="button" class="mg-pac-btn mg-pac-right" data-dir="right" aria-label="Right">▶</button>
                <button type="button" class="mg-pac-btn mg-pac-down" data-dir="down" aria-label="Down">▼</button>
            </div>
        </div>`;

    const c = document.getElementById('mgPac');
    const pad = document.getElementById('mgPacPad');
    const pelEl = document.getElementById('mgPel');
    if (!c || !pad) { cb(false); return; }

    const ctx = c.getContext('2d');
    const maxW = Math.min(400, Math.max(260, (area.clientWidth || 320) - 16));
    const W = maxW;
    const H = Math.round(maxW * 0.75);
    c.width = W;
    c.height = H;

    let pellets = Array.from({ length: 10 }, () => ({
        x: 20 + Math.random() * (W - 40),
        y: 20 + Math.random() * (H - 40),
        got: false
    }));

    let got = 0;
    let done = false;
    let raf = 0;
    const keys = {};
    const move = { up: false, down: false, left: false, right: false };
    let touchOrigin = null;

    const finish = (w) => {
        if (done) return;
        done = true;
        cancelAnimationFrame(raf);
        AN.Minigames._done(w, cb);
    };

    const kd = (e) => {
        keys[e.key] = true;
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(e.key)) {
            e.preventDefault();
        }
    };
    const ku = (e) => { keys[e.key] = false; };

    const setMove = (dir, on) => {
        if (dir && Object.prototype.hasOwnProperty.call(move, dir)) move[dir] = on;
    };

    const bindDirBtn = (btn) => {
        const dir = btn.dataset.dir;
        const press = (e) => {
            e.preventDefault();
            e.stopPropagation();
            setMove(dir, true);
            btn.classList.add('active');
        };
        const release = (e) => {
            e.preventDefault();
            e.stopPropagation();
            setMove(dir, false);
            btn.classList.remove('active');
        };
        btn.addEventListener('mousedown', press);
        btn.addEventListener('mouseup', release);
        btn.addEventListener('mouseleave', release);
        btn.addEventListener('touchstart', press, { passive: false });
        btn.addEventListener('touchend', release, { passive: false });
        btn.addEventListener('touchcancel', release, { passive: false });
    };

    pad.querySelectorAll('.mg-pac-btn').forEach(bindDirBtn);

    const onTouchStart = (e) => {
        if (e.touches.length !== 1) return;
        touchOrigin = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
    const onTouchMove = (e) => {
        if (!touchOrigin || e.touches.length !== 1) return;
        const dx = e.touches[0].clientX - touchOrigin.x;
        const dy = e.touches[0].clientY - touchOrigin.y;
        const t = 10;
        move.left = dx < -t;
        move.right = dx > t;
        move.up = dy < -t;
        move.down = dy > t;
        if (Math.abs(dx) <= t) { move.left = false; move.right = false; }
        if (Math.abs(dy) <= t) { move.up = false; move.down = false; }
        e.preventDefault();
    };
    const onTouchEnd = () => {
        touchOrigin = null;
        move.up = move.down = move.left = move.right = false;
    };

    c.addEventListener('touchstart', onTouchStart, { passive: true });
    c.addEventListener('touchmove', onTouchMove, { passive: false });
    c.addEventListener('touchend', onTouchEnd);
    c.addEventListener('touchcancel', onTouchEnd);

    addEventListener('keydown', kd);
    addEventListener('keyup', ku);

    let pos = { x: W * 0.5, y: H * 0.5 };
    const loop = () => {
        if (done) return;
        const sp = 3.8;
        if (keys.ArrowLeft || keys.a || move.left) pos.x -= sp;
        if (keys.ArrowRight || keys.d || move.right) pos.x += sp;
        if (keys.ArrowUp || keys.w || move.up) pos.y -= sp;
        if (keys.ArrowDown || keys.s || move.down) pos.y += sp;
        pos.x = Math.max(14, Math.min(W - 14, pos.x));
        pos.y = Math.max(14, Math.min(H - 14, pos.y));

        pellets.forEach((p) => {
            if (!p.got && Math.hypot(pos.x - p.x, pos.y - p.y) < 16) {
                p.got = true;
                got++;
                if (pelEl) pelEl.textContent = got;
                if (got >= 10) finish(true);
            }
        });

        ctx.fillStyle = '#0a0820';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#ffd60a';
        pellets.forEach((p) => {
            if (!p.got) {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
                ctx.fill();
            }
        });
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 14, 0, Math.PI * 2);
        ctx.fill();

        raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    AN.Minigames._countdown(18, null, () => finish(got >= 10));

    const prevCleanup = AN.Minigames._cleanup;
    AN.Minigames._cleanup = () => {
        cancelAnimationFrame(raf);
        removeEventListener('keydown', kd);
        removeEventListener('keyup', ku);
        c.removeEventListener('touchstart', onTouchStart);
        c.removeEventListener('touchmove', onTouchMove);
        c.removeEventListener('touchend', onTouchEnd);
        c.removeEventListener('touchcancel', onTouchEnd);
        pad.querySelectorAll('.mg-pac-btn').forEach((btn) => {
            btn.replaceWith(btn.cloneNode(true));
        });
        if (prevCleanup) prevCleanup();
    };
};

/* 9. Pattern Builder */
AN.Minigames.pattern = (cb) => {
    const cols = ['#e63946', '#00b4d8', '#ffd60a', '#2dc653', '#8b5cf6'];
    const pattern = Array.from({ length: 9 }, () => cols[Math.floor(Math.random() * cols.length)]);
    const area = AN.Minigames._area();
    area.innerHTML = '<div class="mg-pattern" id="mgPatGrid"></div><p class="mg-pat-msg" id="mgPatMsg">Memorize!</p><button type="button" class="arcade-btn" id="mgPatSubmit" disabled>CHECK PATTERN</button>';
    const grid = document.getElementById('mgPatGrid');
    const msg = document.getElementById('mgPatMsg');
    const picks = Array(9).fill(0);
    let done = false;
    const finish = w => { if (done) return; done = true; AN.Minigames._done(w, cb); };
    const render = (show) => {
        grid.innerHTML = pattern.map((col, i) =>
            `<button type="button" class="mg-pat-cell" data-i="${i}" style="background:${show ? col : '#222'}"></button>`
        ).join('');
    };
    render(true);
    setTimeout(() => {
        render(false);
        msg.textContent = 'Tap cells to cycle colors, then CHECK';
        document.getElementById('mgPatSubmit').disabled = false;
        grid.querySelectorAll('.mg-pat-cell').forEach(btn => {
            btn.onclick = () => {
                const i = parseInt(btn.dataset.i, 10);
                picks[i] = (picks[i] + 1) % cols.length;
                btn.style.background = cols[picks[i]];
            };
        });
        document.getElementById('mgPatSubmit').onclick = () => {
            const ok = pattern.every((c, j) => c === cols[picks[j]]);
            finish(ok);
        };
    }, 2500);
    AN.Minigames._countdown(20, null, () => finish(false));
};

/* 10. Cold War Decoder — longer words, less time, no lucky same-order scramble */
AN.Minigames.decoder = (cb) => {
    const words = [
        'PERESTROIKA', 'CHALLENGER', 'BERLINWALL', 'GORBACHEV', 'SOLIDARITY',
        'CHERNOBYL', 'COMMODORE', 'TRANSFORM', 'WATERGATE', 'DISCOVERY',
        'COLUMBIA', 'NINTENDO', 'WALKMAN', 'MICROSOFT', 'OLYMPICS'
    ];
    const word = words[Math.floor(Math.random() * words.length)];
    const scrambled = AN.Minigames._scrambleWord(word);
    const area = AN.Minigames._area();
    area.innerHTML = `<p class="mg-sprint-hint">${word.length} letters · unscramble the 1980s word</p><p class="mg-decode-scramble">${scrambled}</p><input type="text" class="mg-input" id="mgDecodeIn" placeholder="Unscramble…" autocomplete="off" spellcheck="false" />`;
    const inp = document.getElementById('mgDecodeIn');
    let done = false;
    const finish = w => { if (done) return; done = true; AN.Minigames._done(w, cb); };
    inp.oninput = () => { if (inp.value.toUpperCase().trim() === word) finish(true); };
    inp.onpaste = (e) => e.preventDefault();
    setTimeout(() => inp.focus(), 100);
    AN.Minigames._countdown(7, null, () => finish(inp.value.toUpperCase().trim() === word));
};
