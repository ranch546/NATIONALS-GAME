/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ui.js — SCREEN CONTROLLER (Presentation / Judge Guide)
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT IT DOES:
 *   Shows/hides HTML screens and fills in text, images, and stats.
 *   Does NOT contain game rules — calls AN.Main for logic.
 *
 * KEY FUNCTIONS:
 *   showLogin() / showHub()     — Player pick & home screen
 *   showTrivia()                — Question, timer, answer cards + images
 *   showTriviaResult()          — Correct/wrong full-screen feedback
 *   playLevelUp()               — Gimkit-style level-up animation
 *   renderLeaderboard()         — All accounts ranked by best score
 *   renderUpgrades()            — Shop UI for permanent power-ups
 * ═══════════════════════════════════════════════════════════════════════════
 */
/* Journey UI */
window.AN = window.AN || {};
AN.UI = {};

AN.UI.$ = (id) => document.getElementById(id);
AN.UI.bind = (id, fn) => { const el = AN.UI.$(id); if (el) el.onclick = fn; };
AN.UI.show = (id) => AN.UI.$(id)?.classList.remove('hidden');
AN.UI.hide = (id) => AN.UI.$(id)?.classList.add('hidden');

AN.UI.toast = (msg, ok) => {
    AN.UI.$('atTitle').textContent = ok ? 'SUCCESS' : 'NOTICE';
    AN.UI.$('atDesc').textContent = msg;
    AN.UI.$('achievementToast').classList.remove('hidden');
    setTimeout(() => AN.UI.$('achievementToast').classList.add('hidden'), 2200);
};

AN.UI.boot = (onDone) => {
    document.body.className = 'phase-boot';
    AN.UI.show('bootScreen');
    const bar = AN.UI.$('bootProgress');
    const status = AN.UI.$('bootStatus');
    let p = 0;
    const iv = setInterval(() => {
        p += 6 + Math.random() * 8;
        bar.style.width = Math.min(100, p) + '%';
        status.textContent = p < 30 ? 'LOADING 80 TRIVIA QUESTIONS…' : p < 60 ? 'SORTING BY DIFFICULTY…' : p < 90 ? 'READY…' : 'LET\'S GO!';
        if (p >= 100) {
            clearInterval(iv);
            setTimeout(() => { AN.UI.hide('bootScreen'); if (onDone) onDone(); }, 350);
        }
    }, 70);
};

AN.UI._pendingLoginId = null;
AN.UI._pendingDeleteId = null;

AN.UI.showLogin = () => {
    document.body.className = 'phase-login';
    AN.UI.hide('hubScreen');
    AN.UI.hide('bootScreen');
    AN.UI.hidePlay();
    AN.UI.show('loginScreen');
    AN.UI.renderPlayerList();
    const err = AN.UI.$('loginError');
    if (err) { err.classList.add('hidden'); err.textContent = ''; }
};

AN.UI.renderPlayerList = () => {
    const list = AN.UI.$('playerList');
    if (!list) return;
    const players = AN.Profiles.list();
    const activeId = AN.Profiles.getActiveId();
    if (!players.length) {
        list.innerHTML = '<p class="login-empty">No players yet — create your profile below!</p>';
        return;
    }
    list.innerHTML = '';
    players
        .sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0))
        .forEach(p => {
            const sum = AN.Profiles.summary(p.id);
            const wrap = document.createElement('div');
            wrap.className = 'player-card-wrap';
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'player-card' + (p.id === activeId ? ' active' : '') + (p.pin ? ' has-pin' : '');
            btn.innerHTML = `
                <div>
                    <div class="player-card-name">${AN.UI._esc(p.name)}</div>
                    <div class="player-card-meta">${sum.rank} · LV ${sum.level} · Best ${sum.bestScore.toLocaleString()} · ${sum.journeys} runs</div>
                </div>
                <span class="player-card-play">PLAY</span>`;
            btn.onclick = () => AN.UI.selectPlayer(p.id);
            const del = document.createElement('button');
            del.type = 'button';
            del.className = 'player-delete-btn';
            del.title = 'Delete account';
            del.textContent = 'DELETE';
            del.onclick = (e) => { e.stopPropagation(); AN.UI.promptDeleteAccount(p.id); };
            wrap.appendChild(btn);
            wrap.appendChild(del);
            list.appendChild(wrap);
        });
};

AN.UI.promptDeleteAccount = (id) => {
    const p = AN.Profiles.get(id);
    if (!p) return;
    AN.UI._pendingDeleteId = id;
    const msg = AN.UI.$('deleteAccountMsg');
    if (msg) {
        msg.textContent = `Permanently delete "${p.name}" and ALL saved progress (XP, tokens, trophies, upgrades)? This cannot be undone.`;
    }
    const pinField = AN.UI.$('deleteConfirmPin');
    const err = AN.UI.$('deleteError');
    if (err) err.classList.add('hidden');
    if (p.pin) {
        pinField?.classList.remove('hidden');
        if (pinField) pinField.value = '';
    } else {
        pinField?.classList.add('hidden');
    }
    AN.UI.show('deleteAccountModal');
    setTimeout(() => (p.pin ? pinField : AN.UI.$('btnDeleteConfirm'))?.focus(), 100);
};

AN.UI.confirmDeleteAccount = () => {
    const id = AN.UI._pendingDeleteId;
    const p = AN.Profiles.get(id);
    if (!p) return;
    const err = AN.UI.$('deleteError');
    if (p.pin) {
        const pin = AN.UI.$('deleteConfirmPin')?.value || '';
        if (pin !== p.pin) {
            if (err) { err.textContent = 'Wrong PIN — cannot delete'; err.classList.remove('hidden'); }
            return;
        }
    }
    const wasActive = AN.Profiles.getActiveId() === id;
    AN.Profiles.delete(id);
    AN.UI.hide('deleteAccountModal');
    AN.UI._pendingDeleteId = null;
    if (wasActive) {
        AN.run.save = AN.defaultSave();
        AN.run.phase = 'login';
        AN.UI.hide('hubScreen');
        AN.UI.hidePlay();
        AN.UI.showLogin();
    } else {
        AN.UI.renderPlayerList();
    }
    AN.UI.toast('Account deleted', false);
};

AN.UI.deleteActiveAccount = () => {
    const id = AN.Profiles.getActiveId();
    if (!id) {
        AN.UI.toast('No player loaded', false);
        return;
    }
    AN.UI.promptDeleteAccount(id);
};

AN.UI._esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

AN.UI.selectPlayer = (id) => {
    const p = AN.Profiles.get(id);
    if (!p) return;
    if (p.pin) {
        AN.UI._pendingLoginId = id;
        AN.UI.$('pinModalTitle').textContent = 'HI ' + p.name.toUpperCase();
        AN.UI.$('pinModalSub').textContent = 'Enter your 4-digit PIN';
        AN.UI.$('pinInput').value = '';
        AN.UI.$('pinError')?.classList.add('hidden');
        AN.UI.show('pinModal');
        setTimeout(() => AN.UI.$('pinInput')?.focus(), 100);
        return;
    }
    AN.Main.loginAs(id);
};

AN.UI.confirmPin = () => {
    const id = AN.UI._pendingLoginId;
    const pin = AN.UI.$('pinInput')?.value || '';
    if (!id) return;
    if (!AN.Profiles.login(id, pin)) {
        const pe = AN.UI.$('pinError');
        if (pe) { pe.textContent = 'Wrong PIN — try again'; pe.classList.remove('hidden'); }
        return;
    }
    AN.UI.hide('pinModal');
    AN.UI._pendingLoginId = null;
    AN.Main.loginAs(id);
};

AN.UI.createPlayer = () => {
    const name = AN.UI.$('newPlayerName')?.value || '';
    const pin = AN.UI.$('newPlayerPin')?.value || '';
    const err = AN.UI.$('loginError');
    const p = AN.Profiles.create(name, pin);
    if (!p) {
        if (err) {
            err.textContent = name.trim().length < 2
                ? 'Name must be at least 2 characters'
                : 'That name is already taken — pick another';
            err.classList.remove('hidden');
        }
        return;
    }
    if (err) err.classList.add('hidden');
    AN.UI.$('newPlayerName').value = '';
    AN.UI.$('newPlayerPin').value = '';
    AN.Main.loginAs(p.id);
};

AN.UI.showHub = () => {
    document.body.className = 'phase-hub';
    AN.UI.hidePlay();
    AN.UI.hide('loginScreen');
    AN.UI.hide('pinModal');
    AN.UI.show('hubScreen');
    const player = AN.Profiles.getActive();
    const nameEl = AN.UI.$('hubPlayerName');
    if (nameEl) nameEl.textContent = player?.name || 'Guest';
    const s = AN.run.save;
    s.tokens = AN.normalizedTokens(s);
    AN.UI.$('hubRank').textContent = AN.rankFor(s.xp);
    AN.UI.$('hubLevel').textContent = 'LV ' + AN.levelFor(s.xp);
    AN.UI.$('hubTokens').textContent = AN.normalizedTokens(s).toLocaleString();
    const xpProg = AN.xpProgress(s.xp);
    AN.UI.$('hubXpFill').style.width = xpProg.pct + '%';
    const lvlEl = AN.UI.$('hubLevel');
    if (lvlEl) lvlEl.textContent = 'LV ' + xpProg.level + ' · ' + xpProg.into + '/' + xpProg.need + ' XP';

    const sorted = AN.sortedQuestionBank(AN.bank);
    const skillPct = Math.round((AN.run.save.adaptiveSkill ?? 0.35) * 100);
    const sub = AN.UI.$('hubQuizSub');
    if (sub) {
        sub.textContent = sorted.length
            ? `${sorted.length} 1980s questions · 90 per run (30 easy + 30 medium + 30 hard) · ${AN.triviaTimeLimit(AN.run.save)}s each`
            : `90 questions per run · 30 easy + 30 medium + 30 hard · +50 XP · 3 ♥ start`;
    }
    AN.UI.updateHubResume();
};

AN.UI.updateHubResume = () => {
    const snap = AN.run?.pausedRun || AN.run?.save?.pausedRun;
    const btn = AN.UI.$('btnResumeJourney');
    const hint = AN.UI.$('hubResumeHint');
    const show = !!(snap?.questions?.length && snap.hearts > 0);
    btn?.classList.toggle('hidden', !show);
    hint?.classList.toggle('hidden', !show);
    if (show && btn) {
        const n = (snap.stopIndex ?? 0) + 1;
        const total = snap.questions.length;
        btn.textContent = `▶ RESUME · Q ${n}/${total} · ${(snap.score || 0).toLocaleString()} pts`;
        if (hint) {
            hint.textContent = snap.playSub === 'result'
                ? `Continue after your last answer · ${snap.hearts} ♥ left`
                : `Continue question ${n} · ${snap.hearts} ♥ left`;
        }
    }
};

AN.UI.showWarp = (tl, done) => {
    AN.UI.hide('hubScreen');
    AN.FX?.warp?.();
    const idx = AN.run?.stopIndex ?? 0;
    const q = AN.run?.questions?.[idx];
    const banner = q ? AN.UI.levelBanner(q, idx, AN.run.questions) : { title: 'QUIZ START', sub: tl.tagline };
    const yearEl = AN.UI.$('warpYear');
    if (yearEl) yearEl.textContent = banner.title;
    AN.UI.show('warpScreen');
    AN.UI.$('warpTitle').textContent = banner.sub.toUpperCase();
    const range = AN.run?._runRangeLabel || '';
    AN.UI.$('warpTip').textContent = (range ? range + ' · ' : '') + '3 ♥';
    setTimeout(() => { AN.UI.hide('warpScreen'); if (done) done(); }, 1800);
};

AN.UI.showLevelAdvance = (levelNum, onDone, coinGain = 0) => {
    const label = AN.quizLevelLabel(levelNum);
    const tips = { 2: 'Medium questions — stay sharp!', 3: 'Hard questions — final stretch!' };
    AN.UI.hide('triviaScreen');
    AN.UI.hide('triviaResult');
    AN.UI.ensurePlayShell();
    AN.FX?.levelUp?.();
    AN.UI.$('levelAdvanceMsg').textContent = 'YOU ARE NOW ADVANCING TO';
    AN.UI.$('levelAdvanceNum').textContent = 'LEVEL ' + levelNum;
    AN.UI.$('levelAdvanceLabel').textContent = label + ' DIFFICULTY';
    let tip = tips[levelNum] || 'Get ready — questions get tougher!';
    if (coinGain > 0) tip += ` · +${coinGain} 🪙 LEVEL BONUS`;
    AN.UI.$('levelAdvanceTip').textContent = tip;
    AN.UI.show('levelAdvanceScreen');
    const r = AN.run;
    if (r?._advanceTimer) clearTimeout(r._advanceTimer);
    r._advanceTimer = setTimeout(() => {
        r._advanceTimer = null;
        AN.UI.hide('levelAdvanceScreen');
        if (onDone) onDone();
    }, 2400);
};

AN.UI.syncDockHeight = () => {
    const dock = AN.UI.$('statusDock');
    if (!dock || dock.classList.contains('hidden')) return;
    // offsetHeight = layout px inside #uiFit; getBoundingClientRect is scaled and too small
    const h = Math.ceil(dock.offsetHeight || dock.getBoundingClientRect().height);
    if (h > 0) {
        const lifeline = AN.UI.$('btnUseLifeline');
        const pad = lifeline && !lifeline.classList.contains('hidden') ? 10 : 0;
        document.documentElement.style.setProperty('--dock-h', (h + pad) + 'px');
    }
};

AN.UI.ensurePlayShell = () => {
    AN.UI.show('playBackdrop');
    AN.UI.show('statusDock');
    AN.Engine?.setUiMode?.(true);
    requestAnimationFrame(() => {
        AN.UI.syncDockHeight();
        requestAnimationFrame(() => AN.UI.syncDockHeight());
    });
};

AN.UI.showPlay = () => {
    document.body.className = 'phase-play';
    AN.UI.hide('hubScreen');
    AN.UI.hide('victoryScreen');
    AN.UI.ensurePlayShell();
    AN.UI.updateHearts();
    AN.UI.updatePlayHud();
};

AN.UI.hidePlay = () => {
    AN.UI.hide('playBackdrop');
    AN.UI.hide('statusDock');
    AN.UI.hide('triviaScreen');
    AN.UI.hide('triviaResult');
    AN.UI.hide('minigameScreen');
    AN.UI.hide('lifelinePrompt');
    AN.UI.hide('levelAdvanceScreen');
    AN.Engine?.setUiMode?.(true);
};

AN.UI.updateHearts = (lostIndex = -1) => {
    if (!AN.run) return;
    const h = Math.max(0, Number(AN.run.hearts) || 0);
    const slots = Math.min(AN.MAX_HEARTS, Math.max(AN.START_HEARTS, h));
    const display = AN.UI.$('heartsDisplay');
    if (display) {
        display.innerHTML = '';
        for (let i = 0; i < slots; i++) {
            const span = document.createElement('span');
            const full = i < h;
            span.className = 'heart-slot' + (full ? ' full' : ' empty');
            if (!full && lostIndex === i) span.classList.add('heart-lost');
            span.textContent = full ? '♥' : '♡';
            display.appendChild(span);
        }
    }
    const countEl = AN.UI.$('heartsCount');
    if (countEl) countEl.textContent = '×' + h;
    const hud = AN.UI.$('hudHearts');
    if (hud) {
        let s = '';
        for (let i = 0; i < slots; i++) s += i < h ? '♥' : '♡';
        hud.textContent = s + ' (' + h + ' lives)';
        hud.title = h + ' / ' + AN.MAX_HEARTS + ' hearts';
    }
};

AN.UI.showMinigame = () => {
    AN.UI.ensurePlayShell();
    const mg = AN.UI.$('minigameScreen');
    mg?.classList.remove('hidden');
    mg?.classList.add('view', 'minigame-screen');
};

AN.UI.hideMinigame = () => {
    AN.UI.hide('minigameScreen');
    const area = AN.UI.$('mgArea');
    if (area) area.innerHTML = '';
    const timer = AN.UI.$('mgTimer');
    if (timer) timer.textContent = '—';
};

AN.UI.difficultyLevelNum = (diff) => AN.quizLevelNum(diff);

AN.UI.levelBanner = (q, index, questions) => {
    const diff = (q.difficulty || 'easy').toLowerCase();
    const lvl = AN.quizLevelNum(diff);
    const diffLabel = diff.charAt(0).toUpperCase() + diff.slice(1);
    const prev = index > 0 ? questions[index - 1] : null;
    const prevLvl = prev ? AN.quizLevelNum(prev.difficulty) : 0;
    let sub = `${diffLabel} difficulty questions`;
    if (lvl > prevLvl && index > 0) {
        sub = `Level ${lvl} unlocked — ${diffLabel.toLowerCase()} questions now!`;
    }
    return { title: `LEVEL ${lvl} · ${diffLabel.toUpperCase()}`, sub };
};

AN.UI.setLifelineActive = (on) => {
    AN.UI.$('triviaScreen')?.querySelector('.trivia-panel')?.classList.toggle('lifeline-active', !!on);
};

AN.UI.updateLifelineBtn = () => {
    const btn = AN.UI.$('btnUseLifeline');
    const r = AN.run;
    const show = !!(r
        && r.phase === 'play'
        && r.playSub === 'trivia'
        && !r._resolving
        && r.hearts > 1
        && !r.lifelineUsedThisQuestion);
    btn?.classList.toggle('hidden', !show);
    if (show) btn.disabled = false;
    requestAnimationFrame(() => {
        AN.UI.syncDockHeight();
        requestAnimationFrame(() => AN.UI.syncDockHeight());
    });
};

AN.UI.refreshTriviaCards = (q, eliminated = new Set()) => {
    const colors = ['a', 'b', 'c', 'd'];
    q.answers.forEach((ans, i) => {
        const card = AN.UI.$(`triviaCard${i}`);
        if (!card) return;
        const isOut = eliminated.has(i);
        card.className = 'trivia-card ' + colors[i] + (isOut ? ' eliminated' : '');
        card.dataset.idx = String(i);
        card.disabled = isOut;
        card.querySelector('.tc-letter').textContent = AN.ANSWER_LABELS[i];
        card.querySelector('.tc-text').textContent = isOut ? '—' : ans;
        card.setAttribute('aria-label', isOut
            ? `Answer ${AN.ANSWER_LABELS[i]} eliminated`
            : `Answer ${AN.ANSWER_LABELS[i]}: ${ans}`);
    });
};

AN.UI.showTrivia = (q, index, total, timelineId, eliminated = new Set()) => {
    AN.UI.hide('triviaResult');
    AN.UI.ensurePlayShell();
    const ts = AN.UI.$('triviaScreen');
    const qEl = AN.UI.$('triviaQuestion');

    const banner = AN.UI.levelBanner(q, index, AN.run?.questions || []);
    const levelEl = AN.UI.$('dockLevel');
    const subEl = AN.UI.$('dockLevelSub');
    if (levelEl) {
        levelEl.textContent = banner.title;
        levelEl.className = 'dock-level level-' + (q.difficulty || 'easy');
    }
    if (subEl) subEl.textContent = banner.sub;

    const sl = AN.UI.$('hudStopLabel');
    if (sl) sl.textContent = `Q ${index + 1} / ${total}`;
    if (qEl) qEl.textContent = q.question;
    const limit = AN.run?.triviaTimeLimit || AN.triviaTimeLimit(AN.run?.save);
    AN.UI.updateTriviaTimer(limit, limit);
    AN.UI.refreshTriviaCards(q, eliminated);

    q.answers.forEach((ans, i) => {
        const card = AN.UI.$(`triviaCard${i}`);
        if (!card) return;
        const isOut = eliminated.has(i);
        const img = card.querySelector('.tc-img');
        const wrap = card.querySelector('.tc-img-wrap');
        if (wrap) {
            wrap.classList.remove('has-img');
            wrap.style.removeProperty('--card-img');
        }
        if (img) {
            img.classList.remove('loaded', 'img-error');
            img.removeAttribute('src');
            img.alt = ans;
            if (!isOut) AN.CueArt.paintCardImage(card, q, i);
        }
    });
    AN.UI.setLifelineActive(!!AN.run?.lifeline5050Active);
    AN.UI.updateLifelineBtn();
    AN.UI.updatePlayHud();

    ts?.classList.add('view', 'trivia-screen');
    ts?.classList.remove('hidden');
    requestAnimationFrame(() => {
        AN.UI.syncDockHeight();
        requestAnimationFrame(() => AN.UI.syncDockHeight());
    });
};

AN.UI.updateTriviaTimer = (t, limit) => {
    const max = limit || AN.run?.triviaTimeLimit || AN.TRIVIA_TIME;
    const left = Math.max(0, t);
    const el = AN.UI.$('triviaTimerNum');
    if (el) el.textContent = String(Math.max(0, Math.ceil(left)));
    const ring = AN.UI.$('triviaTimerRing');
    const screen = AN.UI.$('triviaScreen');
    const pct = max > 0 ? Math.max(0, (left / max) * 100) : 0;
    const urgent = left > 0 && left <= 5;
    if (ring) {
        ring.style.setProperty('--pct', pct + '%');
        ring.classList.toggle('urgent', urgent);
        ring.classList.remove('critical');
        if (urgent && Math.ceil(left) !== AN.UI._lastTimerSec) {
            AN.UI._lastTimerSec = Math.ceil(left);
            AN.FX?.timerTick?.();
        }
        if (!urgent) AN.UI._lastTimerSec = null;
    }
    screen?.classList.toggle('timer-urgent', urgent);
    screen?.classList.remove('timer-critical');
};

AN.UI.playLevelUp = (levelUp, onDone) => {
    const overlay = AN.UI.$('levelUpOverlay');
    if (!overlay) { if (onDone) onDone(); return; }
    AN.FX.levelUp();
    AN.UI.$('levelUpNum').textContent = 'LV ' + levelUp.newLevel;
    const tok = AN.UI.$('levelUpTokens');
    if (tok) tok.textContent = '+' + levelUp.tokensGained + ' 🪙 COINS';
    overlay.classList.remove('hidden');
    overlay.classList.add('show');
    setTimeout(() => {
        overlay.classList.remove('show');
        overlay.classList.add('hidden');
        if (onDone) onDone();
    }, 1600);
};

AN.UI.showTriviaResult = (ok, q, pick, pts, luckySave = false, levelUp = null) => {
    AN.UI.hide('triviaScreen');
    AN.UI.ensurePlayShell();
    const panel = AN.UI.$('triviaResult');
    const gameOver = !ok && AN.run.hearts <= 0;
    const gate = !gameOver && AN.quizLevelGateBlocks(AN.run);
    panel.classList.remove('hidden', 'ok', 'miss', 'game-over', 'level-failed');
    panel.classList.add('view', 'trivia-result', ok ? 'ok' : 'miss');
    if (gameOver) panel.classList.add('game-over');
    if (gate) panel.classList.add('level-failed');

    const banner = AN.UI.$('resultGoBanner');
    if (gameOver) {
        banner?.classList.remove('hidden');
        AN.UI.$('resultTitle').textContent = 'GAME OVER';
    } else if (gate) {
        banner?.classList.remove('hidden');
        banner.textContent = '🚫 NEGATIVE SCORE';
        AN.UI.$('resultTitle').textContent = 'LEVEL FAILED';
    } else {
        banner?.classList.add('hidden');
        banner.textContent = '💔 OUT OF LIVES';
        AN.UI.$('resultTitle').textContent = ok ? 'CORRECT!' : 'WRONG ANSWER';
    }

    let ptsLine = (pts >= 0 ? '+' : '') + pts + ' pts';
    if (ok) {
        const xp = Math.floor(AN.XP_PER_CORRECT * AN.xpMultiplier(AN.run?.save));
        ptsLine += ' · +' + xp + ' XP';
    }
    if (ok && levelUp?.levelsGained > 0) {
        ptsLine += ' · LEVEL UP! +' + levelUp.tokensGained + ' 🪙';
    }
    if (!ok) {
        ptsLine += ' · −1 ♥';
        if (luckySave) ptsLine += ' · 🍀 streak saved!';
    }
    AN.UI.$('resultPoints').textContent = ptsLine;
    AN.UI.$('resultTotalScore').textContent = 'Total score: ' + (AN.run.score || 0).toLocaleString();

    if (gate) {
        const nextLabel = AN.quizLevelLabel(gate.blocked);
        AN.UI.$('resultExplain').textContent =
            `You finished Level ${gate.completed} (${AN.quizLevelLabel(gate.completed)}) with ${gate.score} points. `
            + `You need 0 or higher to unlock Level ${gate.blocked} (${nextLabel}). Try this run again!`;
    } else {
        AN.UI.$('resultExplain').textContent = q.explanation;
    }
    AN.UI.$('resultAnswer').textContent =
        'Correct: ' + AN.ANSWER_LABELS[q.correctIndex] + '. ' + q.answers[q.correctIndex];

    const streakEl = AN.UI.$('resultStreak');
    if (AN.run.streak > 1) {
        streakEl.textContent = 'STREAK ×' + AN.run.streak;
        streakEl.classList.remove('hidden');
    } else streakEl.classList.add('hidden');

    const mgBtn = AN.UI.$('btnLifelineGame');
    const hint = AN.UI.$('resultLifelineHint');
    const btnCont = AN.UI.$('btnContinue');
    const btnRetry = AN.UI.$('btnGameOverRetry');
    const btnHub = AN.UI.$('btnGameOverHub');

    if (gameOver || gate) {
        mgBtn?.classList.add('hidden');
        hint?.classList.add('hidden');
        btnCont?.classList.add('hidden');
        btnRetry?.classList.remove('hidden');
        btnHub?.classList.remove('hidden');
        AN.run.playSub = gameOver ? 'gameover' : 'levelfail';
        if (gate) {
            AN.Main.clearRunTimers?.();
            AN.Main.clearPausedRun?.();
        }
    } else {
        btnCont?.classList.remove('hidden');
        btnRetry?.classList.add('hidden');
        btnHub?.classList.add('hidden');
        if (ok) {
            mgBtn.disabled = false;
            mgBtn.classList.remove('hidden');
            hint?.classList.remove('hidden');
        } else {
            mgBtn.disabled = true;
            mgBtn.classList.add('hidden');
            hint?.classList.add('hidden');
        }
    }
    AN.UI.updatePlayHud();
    const focusBtn = (gameOver || gate) ? btnRetry : (ok ? mgBtn : btnCont);
    setTimeout(() => focusBtn?.focus(), 100);
};

AN.UI.showLifelineHud = (r) => {
    AN.UI.show('lifelinePrompt');
    const tl = AN.TIMELINES[r.timelineId];
    AN.UI.$('lifelineYear').textContent = tl.name;
    AN.UI.$('lifelineTip').textContent = 'WASD move · SPACE jump · reach the green ring';
};

AN.UI.popScore = () => {
    const el = AN.UI.$('hudScore');
    el?.classList.add('pop');
    setTimeout(() => el?.classList.remove('pop'), 400);
};

AN.UI.updatePlayHud = () => {
    const r = AN.run;
    if (!r) return;
    const scoreEl = AN.UI.$('hudScore');
    if (scoreEl) scoreEl.textContent = (r.score || 0).toLocaleString();
    const mins = Math.floor((r.time || 0) / 60);
    const secs = Math.floor((r.time || 0) % 60);
    const timeEl = AN.UI.$('hudTime');
    if (timeEl) timeEl.textContent = mins + ':' + String(secs).padStart(2, '0');
    const streakEl = AN.UI.$('hudStreak');
    if (streakEl) streakEl.textContent = 'STREAK ×' + (r.streak || 0);
    const playerEl = AN.UI.$('hudPlayerName');
    if (playerEl) {
        const xpProg = AN.xpProgress(AN.run.save?.xp || 0);
        const name = AN.Profiles.getActive()?.name || '';
        playerEl.textContent = name ? `${name} · LV ${xpProg.level}` : `LV ${xpProg.level}`;
    }
    const prog = AN.UI.$('journeyProgress');
    if (prog && r.questions) prog.style.width = ((r.stopIndex / r.questions.length) * 100) + '%';
    AN.UI.updateHearts();
    AN.UI.updateLifelineBtn();
    AN.UI.syncDockHeight?.();
};

AN.UI.victory = (stats, loot) => {
    AN.UI.hidePlay();
    AN.UI.show('victoryScreen');
    AN.UI.$('victoryStats').innerHTML = stats;
    AN.UI.$('lootReveal').innerHTML = loot;
    AN.FX?.correct?.();
    setTimeout(() => AN.UI.$('btnVictoryHub')?.focus(), 200);
};

AN.UI.achievement = (ach) => {
    AN.UI.$('atTitle').textContent = ach.name;
    AN.UI.$('atDesc').textContent = ach.desc;
    AN.UI.$('achievementToast').classList.remove('hidden');
    AN.FX.beep(660, 0.15);
    setTimeout(() => AN.UI.$('achievementToast').classList.add('hidden'), 3500);
};

AN.UI.syncCoinsDisplay = () => {
    const tokens = AN.normalizedTokens(AN.run?.save);
    const hub = AN.UI.$('hubTokens');
    if (hub) hub.textContent = tokens.toLocaleString();
    const modal = AN.UI.$('upgradeTokens');
    if (modal) modal.textContent = '🪙 ' + tokens.toLocaleString();
};

AN.UI.renderUpgrades = () => {
    const list = AN.UI.$('upgradeList');
    if (!list || !AN.run?.save) return;
    AN.run.save.tokens = AN.normalizedTokens(AN.run.save);
    AN.UI.syncCoinsDisplay();
    const save = AN.run.save;
    const tokens = AN.normalizedTokens(save);
    list.innerHTML = '';
    AN.UPGRADES.forEach(u => {
        const lv = AN.upgradeLevel(save, u.id);
        const price = AN.upgradePrice(u, lv);
        const maxed = lv >= u.max;
        const canBuy = !maxed && tokens >= price;
        const row = document.createElement('div');
        row.className = 'skill-row upgrade-row';
        row.innerHTML = `
            <div class="upgrade-info">
                <span class="upgrade-icon">${u.icon || '⬆'}</span>
                <div>
                    <strong class="upgrade-name">${u.name}</strong>
                    <span class="upgrade-lv">Lv ${lv} / ${u.max}</span>
                    <p class="upgrade-desc">${u.desc}</p>
                </div>
            </div>`;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'arcade-btn upgrade-buy-btn';
        btn.textContent = maxed ? 'MAXED' : price.toLocaleString() + ' 🪙';
        btn.disabled = !canBuy;
        btn.onclick = () => AN.Main.buyUpgrade(u.id);
        row.appendChild(btn);
        list.appendChild(row);
    });
};

AN.UI.renderLeaderboard = async () => {
    const list = AN.UI.$('leaderboardList');
    const sub = document.querySelector('#leaderboardScreen .modal-sub');
    if (!list) return;
    if (sub) sub.textContent = AN.GlobalLB?.statusText?.() || 'Ranked by best quiz score';
    list.innerHTML = '<p class="leaderboard-empty">Loading scores…</p>';
    const rows = AN.GlobalLB?.getLeaderboard
        ? await AN.GlobalLB.getLeaderboard()
        : AN.Profiles.leaderboard();
    if (!rows.length) {
        list.innerHTML = '<p class="leaderboard-empty">No scores yet — finish a quiz run to appear here!</p>';
        return;
    }
    list.innerHTML = '';
    rows.forEach((row, i) => {
        const el = document.createElement('div');
        el.className = 'leaderboard-row' + (row.isActive ? ' active' : '');
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + (i + 1);
        el.innerHTML = `
            <span class="lb-rank">${medal}</span>
            <div class="lb-player">
                <span class="lb-name">${AN.UI._esc(row.name)}</span>
                <span class="lb-meta">${row.rank} · LV ${row.level}</span>
            </div>
            <div class="lb-stats">
                <span class="lb-score">${row.bestScore.toLocaleString()}</span>
                <span class="lb-sub">${row.journeys} runs · ×${row.bestStreak} streak</span>
            </div>`;
        list.appendChild(el);
    });
};

AN.UI.renderAchievements = () => {
    const list = AN.UI.$('achieveList');
    list.innerHTML = '';
    AN.ACHIEVEMENTS.forEach(a => {
        const got = AN.run.save.achievements.includes(a.id);
        const row = document.createElement('div');
        row.className = 'ach-row trophy-row';
        row.innerHTML = `<span class="trophy-name">${got ? '🏆' : '🔒'} ${a.name}</span><small class="trophy-desc">${a.desc}</small>`;
        list.appendChild(row);
    });
};
