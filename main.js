/**
 * ═══════════════════════════════════════════════════════════════════════════
 * main.js — GAME BRAIN (Presentation / Judge Guide)
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT IT DOES:
 *   Starts the game and runs the main loop. Connects all other files together.
 *
 * KEY FUNCTIONS TO SHOW JUDGES:
 *   init()           — Loads questions, sets up buttons, starts animation loop
 *   startJourney()   — Begins a 10-question run (adaptive difficulty)
 *   beginStop()      — Shows one trivia question + starts 15-second timer
 *   submitTrivia()   — Checks answer, awards XP, level-up, hearts, streak
 *   journeyComplete()— End of run: saves score, shows victory screen
 *   toHub()          — Return home (for upgrades / leaderboard)
 *
 * GLOBAL STATE:
 *   AN.run  — Current session (score, hearts, questions, phase)
 *   AN.bank — All 80 questions loaded from content/questions.json
 * ═══════════════════════════════════════════════════════════════════════════
 */
/* Journey Through the 1980s */
window.AN = window.AN || {};

AN.run = null;
AN.bank = [];

AN.Main = {
    /* ── INIT: wire up UI buttons, load questions, start game loop ── */
    init() {
        AN.UI.applyDeviceClass();
        AN._profilesReady = AN.Profiles.init();
        AN.FX.init();
        AN.Engine.init();
        AN.run = { save: AN.defaultSave(), phase: 'boot' };

        AN._imagesReady = AN.AnswerImages?.init?.() || Promise.resolve();
        AN._bootReady = Promise.all([
            AN.loadQuestionBank(),
            AN._imagesReady
        ]);

        AN.UI.boot(() => {
            Promise.all([AN._bootReady, AN._profilesReady]).then(() => {
                if (!AN.bank?.length) AN.UI.toast('Questions missing — add questions.json next to index.html', false);
                AN.run.phase = 'login';
                AN.UI.showLogin();
            });
        });

        AN.UI.bind('btnCreatePlayer', () => AN.UI.createPlayer());
        AN.UI.bind('btnLoginPlayer', () => AN.UI.loginPlayer());
        AN.UI.bind('btnPinConfirm', () => AN.UI.confirmPin());
        AN.UI.bind('btnPinCancel', () => {
            AN.UI.hide('pinModal');
            document.body.classList.remove('pin-modal-open');
            AN.UI._pendingLoginId = null;
        });
        AN.UI.bind('btnSwitchPlayer', () => AN.Main.switchPlayer());
        AN.UI.bind('btnDeleteMyAccount', () => AN.UI.deleteActiveAccount());
        AN.UI.bind('btnDeleteConfirm', () => AN.UI.confirmDeleteAccount());
        AN.UI.bind('btnDeleteForgotPin', () => AN.UI.toggleDeleteForgotPin());
        AN.UI.bind('btnDeleteCancel', () => {
            AN.UI.hide('deleteAccountModal');
            AN.UI._pendingDeleteId = null;
        });

        AN.UI.$('loginUserId')?.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); AN.UI.loginPlayer(); }
        });
        AN.UI.$('loginPin')?.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); AN.UI.loginPlayer(); }
        });
        AN.UI.$('newPlayerName')?.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); AN.UI.createPlayer(); }
        });
        AN.UI.$('pinInput')?.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); AN.UI.confirmPin(); }
        });
        AN.UI.$('deleteConfirmPin')?.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); AN.UI.confirmDeleteAccount(); }
        });

        AN.UI.bind('btnUpgrades', () => { AN.UI.renderUpgrades(); AN.UI.show('upgradeScreen'); });
        AN.UI.bind('btnCloseUpgrades', () => {
            AN.UI.hide('upgradeScreen');
            AN.UI.syncCoinsDisplay();
        });
        AN.UI.bind('btnLeaderboard', async () => {
            await AN.UI.renderLeaderboard();
            AN.UI.show('leaderboardScreen');
        });
        AN.UI.bind('btnCloseLeaderboard', () => AN.UI.hide('leaderboardScreen'));
        AN.UI.bind('btnAchievements', () => { AN.UI.renderAchievements(); AN.UI.show('achieveScreen'); });
        AN.UI.bind('btnCloseAchieve', () => AN.UI.hide('achieveScreen'));
        AN.UI.bind('btnHowPlay', () => AN.UI.show('helpModal'));
        AN.UI.bind('btnCloseHelp', () => AN.UI.hide('helpModal'));
        AN.UI.bind('btnAccessibility', () => AN.UI.openA11yModal());
        AN.UI.bind('btnCloseA11y', () => AN.UI.hide('a11yModal'));
        AN.A11y.init();
        AN.UI.bindA11yModal();
        AN.UI.bind('btnVictoryHub', () => AN.Main.toHub());
        AN.UI.bind('btnVictoryHubTop', () => AN.Main.toHub());
        AN.UI.bind('btnHubDuringPlay', () => AN.Main.toHub());
        AN.UI.bind('btnUseLifeline', () => { AN.FX?.select?.(); AN.Main.useLifeline5050(); });
        AN.UI.bind('btnVictoryRetry', () => AN.Main.startJourney());
        AN.UI.bind('btnContinue', () => AN.Main.continueAfterResult());
        AN.UI.bind('btnLifelineGame', () => AN.Main.startLifelineMinigame());
        AN.UI.bind('btnStartJourney', () => { AN.FX?.select?.(); AN.Main.startJourney(); });
        AN.UI.bind('btnResumeJourney', () => { AN.FX?.select?.(); AN.Main.resumeJourney(); });
        AN.UI.bind('btnGameOverRetry', () => AN.Main.retryQuiz());
        AN.UI.bind('btnGameOverHub', () => AN.Main.toHub());

        document.querySelectorAll('.trivia-card').forEach(card => {
            card.addEventListener('click', () => {
                const idx = parseInt(card.dataset.idx, 10);
                if (AN.run?.playSub === 'trivia' && !AN.run._resolving && !isNaN(idx)) {
                    AN.Main.submitTrivia(idx);
                }
            });
        });

        addEventListener('keydown', e => {
            const r = AN.run;
            if (!r || r.phase !== 'play') return;

            if (r.playSub === 'trivia' && !r._resolving) {
                const map = { '1': 0, '2': 1, '3': 2, '4': 3 };
                const idx = map[e.key];
                if (idx !== undefined && !r.eliminated?.has(idx)) {
                    e.preventDefault();
                    AN.Main.submitTrivia(idx);
                }
                return;
            }
            if (r.playSub === 'result') {
                if (e.code === 'Space' || e.key === 'Enter') {
                    e.preventDefault();
                    AN.Main.continueAfterResult();
                }
                return;
            }
            if (r.playSub === 'lifeline' && !r.paused) {
                AN.Engine.keys[e.key] = true;
                if (e.code === 'Space') { e.preventDefault(); AN.Engine.jump(); }
            }
        });
        addEventListener('keyup', e => { AN.Engine.keys[e.key] = false; });
        addEventListener('resize', () => {
            AN.UI.applyDeviceClass?.();
            AN.UI.syncDockHeight?.();
        });

        AN.Main.bindSaveOnExit();

        let last = performance.now();
        const loop = (now) => {
            requestAnimationFrame(loop);
            const r = AN.run;
            const needs3d = r?.phase === 'play' && r.playSub === 'lifeline' && !AN.Engine.uiMode;
            if (!needs3d) return;
            const dt = Math.min(0.05, (now - last) / 1000);
            last = now;
            if (!r.paused) r.time += dt;
            AN.Engine.update(dt);
            AN.Engine.render();
        };
        loop(last);
    },

    /* ── START QUIZ: pick 10 adaptive questions, reset hearts/score ── */
    startJourney() {
        AN.Main.clearPausedRun();
        AN.Main.clearRunTimers();
        const go = () => {
            const tl = AN.TIMELINES[AN.JOURNEY_ID];
            if (!tl) return;
            if (!AN.bank?.length) {
                AN.UI.toast('Questions missing — add questions.json next to index.html', false);
                return;
            }
            const r = AN.run;
            r.timelineId = AN.JOURNEY_ID;
            r.questions = AN.pickStructuredRun(AN.bank, r.save);
            if (!AN.isStructuredRunValid(r.questions)) {
                const resetSave = { ...r.save, levelCursors: { easy: 0, medium: 0, hard: 0 } };
                r.questions = AN.pickStructuredRun(AN.bank, resetSave);
            }
            if (!r.questions.length) {
                AN.UI.toast('Not enough questions in bank — check content/questions', false);
                return;
            }
            AN.Main.resetRunForNewQuiz();

            r._runRangeLabel = `90 Qs · Lv1 Easy (30) → Lv2 Medium (30) → Lv3 Hard (30)`;

            AN.UI.showWarp(tl, () => {
                AN.UI.showPlay();
                AN.UI.updateHearts();
                AN.UI.updateShields();
                AN.Main.beginStop(0);
            });
        };
        (AN._imagesReady || Promise.resolve()).then(go);
    },

    stopTriviaTimer() {
        if (AN.run?._triviaIv) {
            clearInterval(AN.run._triviaIv);
            AN.run._triviaIv = null;
        }
    },

    clearRunTimers() {
        AN.Main.stopTriviaTimer();
        const r = AN.run;
        if (!r) return;
        if (r._advanceTimer) {
            clearTimeout(r._advanceTimer);
            r._advanceTimer = null;
        }
        if (r._completeTimer) {
            clearTimeout(r._completeTimer);
            r._completeTimer = null;
        }
    },

    resetRunForNewQuiz() {
        const r = AN.run;
        if (!r) return;
        AN.Main.clearRunTimers();
        r.stopIndex = 0;
        r.score = 0;
        r.streak = 0;
        r.maxStreak = 0;
        r.time = 0;
        r.correct = 0;
        r.hearts = AN.START_HEARTS;
        r.shields = AN.START_LIFELINE_SHIELDS;
        r.phase = 'play';
        r.playSub = '';
        r.paused = true;
        r._resolving = false;
        r._ending = false;
        r._lastResult = null;
        r.currentQ = null;
        r.eliminated = new Set();
        r.triviaTimer = null;
        r.triviaTimeLimit = null;
        r.lifelineUsedThisQuestion = false;
        r.lifeline5050Active = false;
        r.questionsAnswered = 0;
        r.topicsThisRun = {};
        r._learningRecorded = false;
        r.levelStats = AN.Main.freshLevelStats();
    },

    freshLevelStats() {
        return {
            easy: { asked: 0, correct: 0 },
            medium: { asked: 0, correct: 0 },
            hard: { asked: 0, correct: 0 }
        };
    },

    recordTopicAnswer(q) {
        const r = AN.run;
        if (!r || !q) return;
        const cat = q.category || '1980s Trivia';
        if (!r.topicsThisRun) r.topicsThisRun = {};
        r.topicsThisRun[cat] = (r.topicsThisRun[cat] || 0) + 1;
        r.questionsAnswered = (r.questionsAnswered || 0) + 1;
    },

    recordRunLearning() {
        const r = AN.run;
        if (!r?.save || r._learningRecorded) return;
        r._learningRecorded = true;
        const n = r.questionsAnswered || 0;
        r.save.totalQuestionsAnswered = (r.save.totalQuestionsAnswered || 0) + n;
        const set = new Set(r.save.topicsExplored || []);
        Object.keys(r.topicsThisRun || {}).forEach(t => set.add(t));
        r.save.topicsExplored = [...set];
        AN.persist(r.save);
    },

    loseHeart() {
        const r = AN.run;
        if (!r || r.hearts <= 0) return false;
        const lostAt = r.hearts - 1;
        r.hearts = lostAt;
        AN.UI.updateHearts(lostAt);
        return true;
    },

    useLifelineShield() {
        const r = AN.run;
        if (!r || r.shields <= 0) return false;
        r.shields--;
        r.score = Math.max(0, (r.score || 0) - AN.LIFELINE_SHIELD_COST);
        AN.UI.updateShields(r.shields);
        AN.UI.updatePlayHud();
        return true;
    },

    awardHeart(reason) {
        const r = AN.run;
        if (!r || r.hearts >= AN.MAX_HEARTS) {
            if (reason) AN.UI.toast('Hearts maxed out!', false);
            return false;
        }
        r.hearts++;
        AN.UI.updateHearts();
        AN.UI.updatePlayHud();
        AN.FX?.correct?.();
        AN.UI.toast((reason || 'Bonus') + ' — +1 ♥', true);
        return true;
    },

    awardQuizLevelCoins(completedLevelNum) {
        const r = AN.run;
        if (!r?.save) return 0;
        const gain = Math.floor(AN.TOKENS_PER_QUIZ_LEVEL * AN.coinMultiplier(r.save));
        r.save.tokens = AN.normalizedTokens(r.save) + gain;
        AN.persist(r.save);
        AN.UI.syncCoinsDisplay?.();
        return gain;
    },

    checkLevelPerfectReward(tier) {
        const r = AN.run;
        const key = (tier || 'easy').toLowerCase();
        const st = r?.levelStats?.[key];
        if (st && st.asked > 0 && st.correct === st.asked) {
            AN.Main.awardHeart('Perfect ' + key + ' level');
        }
    },

    useLifeline5050() {
        const r = AN.run;
        if (r.playSub !== 'trivia' || r._resolving || r.shields <= 0 || r.lifelineUsedThisQuestion) return;
        const q = r.currentQ;
        if (!q) return;

        const wrong = q.answers
            .map((_, i) => i)
            .filter(i => i !== q.correctIndex && !r.eliminated.has(i));
        if (wrong.length < 2) {
            AN.UI.toast('Not enough answers left to eliminate!', false);
            return;
        }
        for (let i = wrong.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [wrong[i], wrong[j]] = [wrong[j], wrong[i]];
        }
        wrong.slice(0, 2).forEach(i => r.eliminated.add(i));

        AN.Main.useLifelineShield();
        r.lifelineUsedThisQuestion = true;
        r.lifeline5050Active = true;
        AN.UI.refreshTriviaCards(q, r.eliminated);
        AN.UI.setLifelineActive(true);
        AN.UI.updateLifelineBtn();
        AN.Main.startTriviaTimer(AN.LIFELINE_GUESS_TIME);
        r.save.totalLifelines = (r.save.totalLifelines || 0) + 1;
        AN.Main.unlockAch('lifeline5050');
        AN.UI.toast('50/50 — −1 🛡 · −10 pts · 2 wrong answers removed · 10 seconds!', true);
    },

    retryQuiz() {
        AN.UI.hide('triviaResult');
        AN.Main.startJourney();
    },

    /* ── TIMER: counts down each question (base 15s + upgrade bonus) ── */
    startTriviaTimer(initialTime) {
        const r = AN.run;
        AN.Main.stopTriviaTimer();
        r.triviaTimeLimit = r.triviaTimeLimit || AN.triviaTimeLimit(r.save);
        r.triviaTimer = (initialTime != null && initialTime > 0)
            ? Math.min(initialTime, r.triviaTimeLimit)
            : r.triviaTimeLimit;
        AN.UI.updateTriviaTimer(r.triviaTimer, r.triviaTimeLimit);
        r._triviaIv = setInterval(() => {
            if (!r || r.playSub !== 'trivia' || r._resolving) return;
            r.triviaTimer = Math.max(0, r.triviaTimer - 0.1);
            AN.UI.updateTriviaTimer(r.triviaTimer, r.triviaTimeLimit);
            if (r.triviaTimer <= 0) {
                AN.Main.stopTriviaTimer();
                AN.Main.submitTrivia(-1);
            }
        }, 100);
    },

    /* ── UPGRADE POWER: remove wrong answers based on eliminator level ── */
    getEliminatedIndices(q) {
        const count = AN.eliminatorCount(AN.run.save);
        if (!count || !q) return new Set();
        const wrong = q.answers.map((_, i) => i).filter(i => i !== q.correctIndex);
        for (let i = wrong.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [wrong[i], wrong[j]] = [wrong[j], wrong[i]];
        }
        return new Set(wrong.slice(0, count));
    },

    /* ── SHOW QUESTION: display Q, answers, Wikipedia thumbnails ── */
    beginStop(index) {
        const r = AN.run;
        AN.Main.stopTriviaTimer();
        r.stopIndex = index;
        const q = r.questions[index];
        if (!q) { AN.Main.journeyComplete(); return; }

        r.currentQ = q;
        r.playSub = 'trivia';
        r.paused = true;
        r._resolving = false;
        r.lastCorrect = false;
        r.lifelineUsedThisQuestion = false;
        r.lifeline5050Active = false;
        r.eliminated = AN.Main.getEliminatedIndices(q);

        const tier = (q.difficulty || 'easy').toLowerCase();
        const prevQ = index > 0 ? r.questions[index - 1] : null;
        const prevTier = prevQ ? (prevQ.difficulty || 'easy').toLowerCase() : null;
        if (prevTier !== tier) {
            r.shields = AN.START_LIFELINE_SHIELDS;
            AN.UI.updateShields();
        }
        if (!r.levelStats) r.levelStats = AN.Main.freshLevelStats();
        if (r.levelStats[tier]) r.levelStats[tier].asked++;

        AN.UI.hide('triviaResult');
        AN.Engine.clear();
        AN.UI.hide('lifelinePrompt');
        AN.UI.showTrivia(q, index, r.questions.length, r.timelineId, r.eliminated);
        AN.UI.setLifelineActive(false);
        AN.UI.updateLifelineBtn();
        AN.Main.startTriviaTimer();
        AN.CueArt.preloadQuestionImages(q).catch(() => {});
    },

    /* ── ANSWER CHECK: scoring, XP, level-up (+10 coins), hearts, lucky save ── */
    submitTrivia(idx) {
        const r = AN.run;
        if (r.playSub !== 'trivia' || r._resolving) return;
        if (idx >= 0 && r.eliminated?.has(idx)) return;
        r._resolving = true;
        AN.UI.hide('triviaScreen');
        AN.Main.stopTriviaTimer();
        r.triviaTimer = null;

        const q = r.currentQ;
        const pick = idx < 0 ? -1 : idx;
        AN.Main.recordTopicAnswer(q);
        const ok = pick === q.correctIndex;
        let pts = 0;
        let luckySave = false;

        AN.updateAdaptiveSkill(r.save, ok);
        AN.markQuestionSeen(r.save, q.id);

        let levelUp = null;
        const tier = (q.difficulty || 'easy').toLowerCase();
        if (ok) {
            r.streak++;
            r.maxStreak = Math.max(r.maxStreak, r.streak);
            r.correct++;
            if (r.levelStats?.[tier]) r.levelStats[tier].correct++;
            pts = AN.SCORE_CORRECT;
            r.score += pts;
            r.lastCorrect = true;
            const xpGain = Math.floor(AN.XP_PER_CORRECT * AN.xpMultiplier(r.save));
            levelUp = AN.addXp(r.save, xpGain);
            AN.FX.correct();
            AN.FX.floatScore(pts >= 0 ? '+' + pts : String(pts));
            if (r.streak === 5) AN.Main.unlockAch('streak5');
            if (r.correct === 1) AN.Main.unlockAch('first_correct');
        } else {
            const prevStreak = r.streak;
            luckySave = prevStreak > 0 && Math.random() < AN.luckySaveChance(r.save);
            if (!luckySave) r.streak = 0;
            pts = AN.SCORE_WRONG;
            r.score += pts;
            r.lastCorrect = false;
            AN.Main.loseHeart();
            AN.FX.wrong();
            AN.FX.floatScore(String(pts));
        }
        r.lifeline5050Active = false;
        AN.UI.setLifelineActive(false);
        AN.UI.updateLifelineBtn();

        AN.persist(r.save);
        r.playSub = 'result';
        r._lastResult = { ok, pick, pts, luckySave, levelUp };
        const showResult = () => {
            AN.UI.showTriviaResult(ok, q, pick, pts, luckySave, levelUp);
            r._resolving = false;
        };
        if (levelUp?.levelsGained > 0) {
            AN.UI.playLevelUp(levelUp, showResult);
        } else {
            showResult();
        }
        AN.UI.popScore();
        AN.UI.updatePlayHud();
    },

    continueAfterResult() {
        const r = AN.run;
        if (r.playSub !== 'result' || r._resolving) return;
        if (r.hearts <= 0 || r.playSub === 'levelfail') return;
        if (AN.quizLevelGateBlocks(r)) return;
        AN.UI.hide('triviaResult');
        AN.UI.hide('triviaScreen');
        r.playSub = 'transition';
        AN.Main.advanceStop();
    },

    /* ── BONUS CHALLENGE: mini-game after correct answer — win = +1 heart ── */
    startLifelineMinigame() {
        const r = AN.run;
        if (!r.lastCorrect) {
            AN.UI.toast('Answer correctly to unlock the bonus challenge!', false);
            return;
        }
        AN.UI.hide('triviaResult');
        r.playSub = 'minigame';
        AN.UI.showMinigame();
        AN.Minigames.start(won => {
            AN.UI.hideMinigame();
            if (won) {
                AN.Main.awardHeart('Challenge complete');
                r.save.totalBonusWins = (r.save.totalBonusWins || 0) + 1;
                AN.Main.unlockAch('bonus_win');
            } else {
                AN.FX.wrong();
                AN.UI.toast('Challenge failed — no extra heart', false);
            }
            AN.UI.updatePlayHud();
            AN.Main.advanceStop();
        });
    },

    lifelineComplete() {
        const r = AN.run;
        if (r.playSub !== 'lifeline') return;
        AN.UI.hide('lifelinePrompt');
        AN.Main.advanceStop();
    },

    advanceStop() {
        const r = AN.run;
        if (!r || r.phase !== 'play') return;
        if (AN.quizLevelGateBlocks(r)) return;

        const q = r.questions?.[r.stopIndex];
        const advancingTo = AN.nextQuizLevelAfter(r.stopIndex, r.questions);
        if (q && AN.isLastQuestionInLevel(r.stopIndex, r.questions)) {
            AN.Main.checkLevelPerfectReward(q.difficulty);
            if (advancingTo) r._levelCoinGain = AN.Main.awardQuizLevelCoins(AN.quizLevelNum(q.difficulty));
        }

        r.paused = true;
        r.playSub = 'transition';
        AN.Engine.clear();
        const next = r.stopIndex + 1;
        if (next >= r.questions.length) {
            if (q && AN.isLastQuestionInLevel(r.stopIndex, r.questions)) {
                r._levelCoinGain = AN.Main.awardQuizLevelCoins(AN.quizLevelNum(q.difficulty));
            }
            r._completeTimer = setTimeout(() => {
                r._completeTimer = null;
                AN.Main.journeyComplete();
            }, 400);
        } else {
            const goNext = () => {
                r._advanceTimer = null;
                if (AN.run?.playSub === 'levelfail' || AN.run?.phase !== 'play') return;
                AN.Main.beginStop(next);
            };
            if (advancingTo) {
                AN.UI.showLevelAdvance(advancingTo, goNext, r._levelCoinGain);
            } else {
                goNext();
            }
        }
    },

    /* ── END OF RUN: save XP/tokens, advance adaptive skill, victory screen ── */
    journeyComplete() {
        const r = AN.run;
        if (r._ending) return;
        AN.Main.clearPausedRun();
        r._ending = true;
        r.paused = true;
        r.playSub = 'done';

        const bonus = Math.floor((500 + Math.floor(r.score * 0.2)) * AN.xpMultiplier(r.save));
        const tokenGain = Math.floor(30 * AN.coinMultiplier(r.save));
        r.save.xp += bonus;
        r.save.tokens = AN.normalizedTokens(r.save) + tokenGain;
        r.save.journeys++;
        r.save.totalCorrect += r.correct;
        r.save.bestScore = Math.max(r.save.bestScore, r.score);
        r.save.bestStreak = Math.max(r.save.bestStreak, r.maxStreak);
        AN.advanceLevelCursors(r.save, AN.bank, r.questions);
        if (r.correct === r.questions.length) AN.Main.unlockAch('perfect_run');
        AN.Main.unlockAch('journey_clear');
        if (r.score >= 150) AN.Main.unlockAch('high_score');
        AN.Main.recordRunLearning();
        AN.persist(r.save);

        const skillPct = Math.round((r.save.adaptiveSkill ?? 0.35) * 100);
        const impact = AN.UI.buildImpactReport(r, r.save, { lifetime: true });
        const stats = `
            <div class="stat-line"><span>Quiz</span><span>${r._runRangeLabel || 'Time Travel'}</span></div>
            <div class="stat-line"><span>Score</span><span>${r.score.toLocaleString()}</span></div>
            <div class="stat-line"><span>Correct</span><span>${r.correct}/${r.questions.length}</span></div>
            <div class="stat-line"><span>Best streak</span><span>×${r.maxStreak}</span></div>
            <div class="stat-line"><span>XP</span><span>+${bonus}</span></div>
            <div class="stat-line"><span>Skill</span><span>${skillPct}%</span></div>`;
        const loot = `<div class="loot-item">+${tokenGain} run bonus 🪙</div><div class="loot-item">+30 🪙 per quiz level cleared</div><div class="loot-item">Next run continues through the question bank</div>`;

        setTimeout(() => {
            AN.UI.victory(stats, loot, impact);
            r.phase = 'victory';
            r._ending = false;
        }, 300);
    },

    loginAs(profileId) {
        if (!AN.Profiles.setActive(profileId)) return;
        const profile = AN.Profiles.getActive();
        if (profile && AN.GlobalLB?.isEnabled?.()) {
            AN.GlobalLB.claimUserId(profile.name, profile.globalId).then((ok) => {
                if (!ok) AN.UI.toast('This User ID is already registered on another device', false);
            });
        }
        AN.run.save = AN.loadSave();
        AN.run.pausedRun = AN.run.save.pausedRun || null;
        AN.run.phase = 'hub';
        AN.UI.showHub();
        const userId = AN.Profiles.getActive()?.name || 'Player';
        AN.UI.toast('Welcome back, ' + userId + '!', true);
    },

    bindSaveOnExit() {
        const flush = () => {
            const r = AN.run;
            if (!r?.save || !AN.Profiles.getActiveId()) return;
            const inProgress = r.phase === 'play'
                && Array.isArray(r.questions) && r.questions.length
                && !r._ending
                && r.playSub !== 'done'
                && r.hearts > 0;
            if (inProgress) AN.Main.savePausedRun();
            else AN.persist(r.save);
        };
        addEventListener('pagehide', flush);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') flush();
        });
    },

    switchPlayer() {
        const r = AN.run;
        AN.Main.stopTriviaTimer();
        AN.Main.clearPausedRun();
        if (r?.save) AN.persist(r.save);
        r.phase = 'login';
        AN.Engine.clear();
        AN.UI.hide('victoryScreen');
        AN.UI.hide('triviaScreen');
        AN.UI.hide('triviaResult');
        AN.UI.hidePlay();
        AN.UI.showLogin();
    },

    savePausedRun() {
        const r = AN.run;
        if (!r?.questions?.length || r.hearts <= 0) return;
        const snap = {
            questions: r.questions,
            stopIndex: r.stopIndex,
            score: r.score,
            streak: r.streak,
            maxStreak: r.maxStreak,
            time: r.time,
            correct: r.correct,
            hearts: r.hearts,
            shields: r.shields,
            timelineId: r.timelineId,
            _runRangeLabel: r._runRangeLabel,
            playSub: r.playSub,
            triviaTimer: r.triviaTimer,
            triviaTimeLimit: r.triviaTimeLimit,
            lastCorrect: r.lastCorrect,
            eliminated: r.eliminated ? [...r.eliminated] : [],
            result: r._lastResult || null
        };
        r.pausedRun = snap;
        r.save.pausedRun = snap;
        AN.persist(r.save);
    },

    clearPausedRun() {
        if (AN.run) AN.run.pausedRun = null;
        if (AN.run?.save) {
            delete AN.run.save.pausedRun;
            AN.persist(AN.run.save);
        }
    },

    resumeJourney() {
        const snap = AN.run?.pausedRun || AN.run?.save?.pausedRun;
        if (!snap?.questions?.length || snap.hearts <= 0) {
            AN.UI.toast('No quiz in progress to resume', false);
            return;
        }
        if (!AN.isStructuredRunValid(snap.questions)) {
            AN.UI.toast('Saved quiz was outdated — starting a fresh run', false);
            AN.Main.clearPausedRun();
            AN.Main.startJourney();
            return;
        }

        const r = AN.run;
        r.questions = snap.questions;
        r.stopIndex = snap.stopIndex;
        r.score = snap.score ?? 0;
        r.streak = snap.streak ?? 0;
        r.maxStreak = snap.maxStreak ?? 0;
        r.time = snap.time ?? 0;
        r.correct = snap.correct ?? 0;
        r.hearts = snap.hearts;
        r.shields = typeof snap.shields === 'number' ? snap.shields : AN.START_LIFELINE_SHIELDS;
        r.timelineId = snap.timelineId || AN.JOURNEY_ID;
        r._runRangeLabel = snap._runRangeLabel || '';
        r.phase = 'play';
        r._resolving = false;
        r._ending = false;
        r.lastCorrect = !!snap.lastCorrect;

        AN.Main.clearPausedRun();

        const q = r.questions[r.stopIndex];
        if (!q) {
            AN.UI.toast('Could not resume — starting fresh', false);
            AN.Main.startJourney();
            return;
        }
        r.currentQ = q;

        AN.UI.showPlay();
        AN.UI.updateHearts();
        AN.UI.updateShields();
        AN.UI.updatePlayHud();
        AN.Engine.clear();

        if (snap.playSub === 'result' && snap.result) {
            r.playSub = 'result';
            r._lastResult = snap.result;
            const { ok, pick, pts, luckySave, levelUp } = snap.result;
            AN.UI.showTriviaResult(ok, q, pick, pts, luckySave, levelUp);
            return;
        }

        r.playSub = 'trivia';
        r.eliminated = new Set(snap.eliminated || []);
        r.triviaTimeLimit = snap.triviaTimeLimit || AN.triviaTimeLimit(r.save);
        const timeLeft = snap.triviaTimer != null ? snap.triviaTimer : r.triviaTimeLimit;

        AN.UI.showTrivia(q, r.stopIndex, r.questions.length, r.timelineId, r.eliminated);
        AN.Main.startTriviaTimer(timeLeft);
        AN.CueArt.preloadQuestionImages(q).catch(() => {});
    },

    toHub() {
        const r = AN.run;
        AN.Main.stopTriviaTimer();
        const inProgress = r?.phase === 'play'
            && Array.isArray(r.questions) && r.questions.length
            && !r._ending
            && r.playSub !== 'done'
            && r.hearts > 0;

        if (inProgress) AN.Main.savePausedRun();
        else AN.Main.clearPausedRun();

        if (r?.score) {
            r.save.bestScore = Math.max(r.save.bestScore || 0, r.score);
            AN.persist(r.save);
        }
        r.phase = 'hub';
        AN.Engine.clear();
        AN.UI.hide('victoryScreen');
        AN.UI.hide('triviaScreen');
        AN.UI.hide('triviaResult');
        AN.UI.hidePlay();
        AN.UI.showHub();
    },

    buyUpgrade(id) {
        const u = AN.upgradeById(id);
        const save = AN.run?.save;
        if (!u || !save) return;

        const lv = AN.upgradeLevel(save, id);
        const price = AN.upgradePrice(u, lv);
        const tokens = AN.normalizedTokens(save);

        if (lv >= u.max) {
            AN.UI.toast(u.name + ' is already maxed!', false);
            return;
        }
        if (tokens < price) {
            AN.UI.toast(`Need ${price.toLocaleString()} 🪙 — you have ${tokens.toLocaleString()}`, false);
            return;
        }

        save.tokens = tokens - price;
        if (!save.upgrades) save.upgrades = { ...AN.defaultSave().upgrades };
        save.upgrades[id] = lv + 1;
        AN.persist(save);
        AN.Main.unlockAch('first_upgrade');
        AN.UI.syncCoinsDisplay();
        AN.UI.renderUpgrades();
        AN.FX?.select?.();
        AN.UI.toast(`${u.name} → Lv ${lv + 1}! (−${price.toLocaleString()} 🪙)`, true);
    },

    unlockAch(id) {
        const save = AN.run?.save;
        if (!save) return;
        if (!save.achievements) save.achievements = [];
        if (save.achievements.includes(id)) return;
        if (!AN.ACHIEVEMENTS.some(a => a.id === id)) return;
        save.achievements.push(id);
        const ach = AN.ACHIEVEMENTS.find(a => a.id === id);
        if (ach) AN.UI.achievement(ach);
        AN.persist(save);
    }
};

AN.Main.init();
