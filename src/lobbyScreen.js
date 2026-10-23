// 待合室とコースの投票の画面（設計書 docs/superpowers/specs/2026-10-22-lobby-design.md の 2.1・4章）
import { faceSvg } from './titleArt.js?v=669b1ac';
import { charOf } from './data/characters.js?v=669b1ac';
import { PHRASES, phrase, pickedText } from './chatPhrases.js?v=669b1ac';
import { CHAT_MAX, CHAT_SHOW, cleanText, canSend, samePreset, sendChat, lastMessages, displayText, nextChime } from './net/chat.js?v=669b1ac';
import { enterLobby, rejoinLobby, leaveLobby, setReady, playersOf } from './net/lobby.js?v=669b1ac';
import { allReady, startVote, castVote, decideVote, resetRoom, roomStale, racingStale, racersLeft } from './net/room.js?v=669b1ac';
import { startPerf } from './net/perf.js?v=669b1ac';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const face = (char) => `<span class="lb-face" style="background:#${charOf(char).body.toString(16).padStart(6, '0')}">${faceSvg(char)}</span>`;

export function lobbyRows(players, myUid) {
  return `<p class="lb-count">${players.length} ${players.length === 1 ? 'player' : 'players'}</p>${players
    .map((p) => `<div class="row${p.uid === myUid ? ' me' : ''}">${face(p.char)}<span class="lb-name">${esc(p.name)}</span><span class="lb-ready">${p.ready ? '✓' : '…'}</span></div>`)
    .join('')}`;
}

export function messageRows(msgs, myUid, lang) {
  return msgs.map((m) => `<div class="msg${m.uid === myUid ? ' mine' : ''}">${face(m.char)}<span class="msg-name">${esc(m.name)}</span><span class="msg-text">${esc(displayText(m, lang))}</span></div>`).join('');
}

export function voteRows(courses, votes, voteId, players) {
  const charOfUid = Object.fromEntries(players.map((p) => [p.uid, p.char]));
  return courses
    .map((name, i) => {
      const who = Object.entries(votes ?? {}).filter(([, v]) => v?.voteId === voteId && v.course === i).map(([uid]) => face(charOfUid[uid] ?? 'kyugo'));
      return `<button type="button" class="vote-course" data-course="${i}"><span>${esc(name)}</span><span class="vote-faces">${who.join('')}</span></button>`;
    })
    .join('');
}

// レース中に来た人（と QUIT した人）への知らせ（M4-C1）。英語だけ
export function racingText(courseName, names) {
  return `Racing now: ${courseName}${names.length ? ` — ${names.join(', ')}` : ''}. Press READY after the race.`;
}

// READY を押せるのは、部屋がないか lobby のときだけ（投票中・決まった・レース中は押せない）
export function canReady(room) {
  return !room || room.phase === 'lobby';
}

// 待合室。戻り値: 'back'（タイトルへ）/ 'chars'（キャラを選び直す）/ 'recode'（コードが変わった）
// コースが決まって自分が走る人なら、「選ばれました」の3秒のあと ctx.onDecided(room, players) でレースへ（M4-C1）。
// onDecided が 'back' を返したら（遊べる時間が終わった）、待合室を出る
export function runLobby(root, ctx) {
  const { db, me } = ctx;
  let lang = ctx.lang;
  let offset = 0;
  const serverNow = () => Date.now() + offset;
  const state = { players: [], room: null, votes: null, msgs: [], status: null, played: null, race: { id: null, startAt: null, course: null, racers: null, goals: null } };
  const offs = [];
  let lastSent = null;
  let lastPreset = null; // 最後に送った定型文（同じものは続けて送れない）
  let chimeState = { loaded: false, lastId: null };
  let finished = false;
  let inRace = false; // レースの画面にいる間（待合室の HTML はない）
  let pending = null; // レースの間に出ることになったら（コードが変わった など）、レースのあとで出る
  let stopPerf = () => {};
  return new Promise((resolve) => {
    root.classList.add('show');
    root.innerHTML = `<div class="panel lobby">
      <div class="lb-top">
        <button type="button" class="back-btn" data-act="back">◀ TITLE</button>
        <button type="button" data-act="chars">Character</button>
        <div class="lb-gear"> <!-- 音・定型文の言語。歯車なしで、いつも出す。操作（ボタン / キーボード）は SOLO と同じく自動（2026-10-23 のユーザー依頼） -->
          <button type="button" data-act="sound"></button>
          <button type="button" data-act="lang"></button>
        </div>
        <button type="button" class="lb-ready-btn" data-act="ready">READY</button>
      </div>
      <p class="lb-racing hidden"></p>
      <div class="lb-main">
        <div class="lb-list"></div>
        <div class="lb-chat">
          <div class="lb-msgs"></div>
          <div class="lb-presets"></div>
          <form class="lb-form"><input type="text" maxlength="${CHAT_MAX}" placeholder="Message"><button type="submit">Send</button></form>
        </div>
        <div class="lb-vote hidden"><h1>Choose the course</h1><p class="vote-left"></p><div class="vote-list"></div><p class="vote-picked"></p></div>
      </div>
    </div>`;
    const $ = (sel) => root.querySelector(sel);
    const finish = async (why) => {
      if (finished) return;
      if (inRace) {
        pending = pending ?? why; // レースの画面をこわさない。レースのあとで出る
        return;
      }
      finished = true;
      stopPerf();
      clearInterval(tick);
      offs.forEach((off) => off());
      await leaveLobby(db, me.uid).catch(() => {});
      root.onclick = null;
      root.onsubmit = null;
      root.classList.remove('show');
      root.innerHTML = '';
      resolve(why);
    };
    const drawGear = () => {
      if (!$('[data-act="sound"]')) return; // 知らせ・レースの間は、待合室の HTML がない
      // 小さい画面では、絵と短い文字だけ（.wide は CSS で隠す）
      $('[data-act="sound"]').innerHTML = ctx.sound.isOn() ? '🔊<span class="wide"> Sound ON</span>' : '🔇<span class="wide"> Sound OFF</span>';
      $('[data-act="lang"]').innerHTML = lang === 'ja' ? '<span class="wide">Chat: </span>日本語' : '<span class="wide">Chat: </span>English';
    };
    const drawPresets = () => {
      if (!$('.lb-presets')) return;
      $('.lb-presets').innerHTML = PHRASES.map((_, i) => `<button type="button" data-preset="${i}"${i === lastPreset ? ' class="used"' : ''}>${esc(phrase(i, lang))}</button>`).join('');
    };
    const drawMsgs = () => {
      if (!$('.lb-msgs')) return;
      const box = $('.lb-msgs');
      box.innerHTML = messageRows(state.msgs, me.uid, lang);
      box.scrollTop = box.scrollHeight;
    };
    const drawList = () => {
      if (!$('.lb-list')) return;
      $('.lb-list').innerHTML = lobbyRows(state.players, me.uid);
      const mine = state.players.find((p) => p.uid === me.uid);
      $('.lb-ready-btn').classList.toggle('on', !!mine?.ready);
      $('.lb-ready-btn').textContent = mine?.ready ? 'READY ✓' : 'READY';
    };
    // レース中（M4-C1）: 今のレースのコースと、走っている人の名前
    const drawRacing = () => {
      const el = $('.lb-racing');
      if (!el) return;
      const racing = state.room?.phase === 'racing';
      el.classList.toggle('hidden', !racing);
      if (!racing) return;
      const names = Object.values(state.race.racers ?? {}).sort((a, b) => a.slot - b.slot).map((r) => r.name);
      el.textContent = racingText(ctx.courses[state.race.course ?? state.room.course] ?? '', names);
    };
    const drawVote = () => {
      if (!$('.lb-vote')) return;
      const r = state.room;
      const voting = r?.phase === 'voting' || r?.phase === 'decided';
      $('.lb-vote').classList.toggle('hidden', !voting);
      $('.lb-ready-btn').classList.toggle('off', voting || r?.phase === 'racing'); // 投票中・レース中は READY を出さない
      drawRacing();
      if (!voting) return;
      $('.vote-list').innerHTML = voteRows(ctx.courses, state.votes, r.voteId, state.players);
      const left = Math.max(0, Math.ceil((r.endsAt - serverNow()) / 1000));
      $('.vote-left').textContent = r.phase === 'voting' ? `${left}` : '';
      $('.vote-picked').textContent = r.phase === 'decided' ? pickedText(ctx.courses[r.course], lang) : '';
    };
    const drawAll = () => {
      drawGear();
      drawPresets();
      drawMsgs();
      drawList();
      drawVote();
    };
    const send = async (body) => {
      if (samePreset(lastPreset, body)) return false;
      if (!canSend(lastSent, serverNow(), 'preset' in body ? 'preset' : 'text')) return false;
      const prev = lastSent;
      lastSent = serverNow();
      const ok = await sendChat(db, me.codeId, me, body).then(() => true, () => false);
      if (!ok) lastSent = prev; // 送れなかったら、打った文は残して、すぐ送り直せる
      if (ok) {
        lastPreset = 'preset' in body ? body.preset : null;
        // 送った定型文のボタンを薄くする（並びは描き直さない。横にずらした位置がもどらないように）
        root.querySelectorAll('.lb-presets button').forEach((x) => x.classList.toggle('used', Number(x.dataset.preset) === lastPreset));
      }
      return ok;
    };
    root.onclick = async (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'back') return finish('back');
      if (act === 'chars') return finish('chars');
      if (act === 'sound') ctx.sound.setOn(!ctx.sound.isOn());
      if (act === 'lang') {
        lang = lang === 'ja' ? 'en' : 'ja';
        ctx.setLang(lang);
        drawPresets();
        drawMsgs();
      }
      if (act === 'sound' || act === 'lang') return drawGear();
      if (act === 'ready') {
        if (!canReady(state.room)) return; // 投票中・レース中は READY を押せない（レース中に来た人は、レースが終わってから）
        const mine = state.players.find((p) => p.uid === me.uid);
        return setReady(db, me.uid, !mine?.ready).catch(() => {});
      }
      if (b.dataset.preset) return send({ preset: Number(b.dataset.preset) });
      if (b.dataset.course && state.room?.phase === 'voting' && state.room.racers?.[me.uid]) return castVote(db, me.uid, state.room.voteId, Number(b.dataset.course)).catch(() => {});
    };
    // 送信は root で受ける（待合室の HTML を描き直しても効くように）
    root.onsubmit = async (e) => {
      if (!e.target.closest('.lb-form')) return;
      e.preventDefault();
      const input = $('.lb-form input');
      const text = cleanText(input.value);
      if (!text) return;
      if (await send({ text })) input.value = '';
    };
    drawGear();
    drawPresets();
    // 1秒に4回: 投票の残りの秒、全員 READY なら始める、締め切りなら決める、走る人が1人なら戻す、止まった部屋を戻す
    const tick = setInterval(() => {
      const r = state.room;
      const now = serverNow();
      if (roomStale(r, now) || racingStale(r, state.race, state.players, now)) resetRoom(db, r.voteId).catch(() => {}); // 止まった部屋は、走る人でなくても戻す
      else if (!r || r.phase === 'lobby') {
        if (allReady(state.players)) startVote(db, state.players, now).catch(() => {});
      } else if (r.phase === 'voting') {
        if (racersLeft(r, state.players) < 2) resetRoom(db, r.voteId).catch(() => {});
        else if (now >= r.endsAt) decideVote(db, r, state.votes, ctx.courses.length, state.played).catch(() => {}); // 同じ数なら、まだ走っていないコース
      }
      drawVote();
    }, 250);
    offs.push(db.serverOffset((v) => { offset = v; }));
    offs.push(db.watch('lobby', (v) => { state.players = playersOf(v); drawList(); }));
    offs.push(db.watch('votes', (v) => { state.votes = v; drawVote(); }));
    offs.push(db.watch('played', (v) => { state.played = v; }));
    // 今のレース（車の様子 karts は見ない。1秒に何十回も変わるので）
    for (const key of ['id', 'startAt', 'course', 'racers', 'goals']) {
      offs.push(db.watch(`race/${key}`, (v) => { state.race[key] = v; drawRacing(); }));
    }
    offs.push(db.watch(`chat/${me.codeId}`, (v) => {
      state.msgs = lastMessages(v, CHAT_SHOW);
      const res = nextChime(chimeState, state.msgs, me.uid);
      chimeState = res.state;
      if (res.chime && !inRace) ctx.chime();
      drawMsgs();
    }, { last: CHAT_SHOW }));
    offs.push(db.watch('room', async (v) => {
      if (finished) return; // 待合室を出たあとは、何もしない
      const prev = state.room;
      state.room = v;
      drawVote();
      // コースが決まった: 「〇〇が選ばれました！」を3秒、観客の歓声と一緒に（2026-10-22 のユーザー依頼）
      if (v?.phase === 'decided' && prev?.phase !== 'decided') ctx.cheer?.(3);
      // 走る人は、そのあとレースへ（M4-C1）。終わったら待合室に戻す（READY は外れたまま）
      if (v?.phase === 'decided' && prev?.phase !== 'decided' && v.racers?.[me.uid]) {
        await new Promise((r) => setTimeout(r, 3000));
        if (finished) return;
        inRace = true;
        const after = await Promise.resolve(ctx.onDecided(v, state.players)).catch(() => 'lobby');
        inRace = false;
        if (pending) return finish(pending);
        if (after === 'back') return finish('back');
        if (finished) return;
        // QUIT で先に戻ったときは、部屋を戻さない（ほかの人はまだ走っている。終わった人の端末か、止まった部屋の見はりが戻す）
        if (after !== 'quit') await resetRoom(db, v.voteId).catch(() => {});
        drawAll();
      }
      // 投票が始まったら、自分の READY を外す（決まって待合室に戻ったとき、READY が残っていて、すぐ次の投票が始まらないように）
      if (v?.phase === 'voting' && prev?.phase !== 'voting') setReady(db, me.uid, false).catch(() => {});
    }));
    offs.push(db.watch('status', (s) => {
      if (!s?.active || s.codeId !== me.codeId) finish('recode');
    }));
    // 電波が切れてもどったら入り直す（切れた間にサーバーが自分の行を消しているため。READY を押しても何も起きなくなっていた）
    let wasOnline = null;
    if (db.connected) offs.push(db.connected((on) => {
      if (on && wasOnline === false && !finished) rejoinLobby(db, me).catch(() => {});
      wasOnline = on;
    }));
    enterLobby(db, me)
      .then(() => {
        // 性能の点数（M4-C1）。待合室の行を書いてから
        if (!finished && ctx.fps) stopPerf = startPerf(db, me.uid, { fps: ctx.fps }).stop;
      })
      .catch(() => finish('recode'));
  });
}
