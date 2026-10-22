// 待合室とコースの投票の画面（設計書 docs/superpowers/specs/2026-10-22-lobby-design.md の 2.1・4章）
import { faceSvg } from './titleArt.js';
import { charOf } from './data/characters.js';
import { PHRASES, phrase, pickedText } from './chatPhrases.js';
import { CHAT_MAX, CHAT_SHOW, cleanText, canSend, sendChat, lastMessages, displayText, nextChime } from './net/chat.js';
import { enterLobby, leaveLobby, setReady, playersOf } from './net/lobby.js';
import { allReady, startVote, castVote, decideVote, resetRoom, roomStale, racersLeft } from './net/room.js';

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

// 待合室。戻り値: 'back'（タイトルへ）/ 'chars'（キャラを選び直す）/ 'recode'（コードが変わった）
export function runLobby(root, ctx) {
  const { db, me } = ctx;
  let lang = ctx.lang;
  let offset = 0;
  const serverNow = () => Date.now() + offset;
  const state = { players: [], room: null, votes: null, msgs: [], status: null };
  const offs = [];
  let lastSent = null;
  let chimeState = { loaded: false, lastId: null };
  let finished = false;
  return new Promise((resolve) => {
    root.classList.add('show');
    root.innerHTML = `<div class="panel lobby">
      <div class="lb-top">
        <button type="button" class="back-btn" data-act="back">◀ BACK</button>
        <button type="button" data-act="chars">Character</button>
        <button type="button" data-act="gear" aria-label="Settings">⚙</button>
        <button type="button" class="lb-ready-btn" data-act="ready">READY</button>
      </div>
      <div class="lb-gear hidden">
        <button type="button" data-act="sound"></button>
        <button type="button" data-act="controls"></button>
        <button type="button" data-act="lang"></button>
      </div>
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
      finished = true;
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
      if (!$('[data-act="sound"]')) return; // 知らせが出ている間は、待合室の HTML がない
      $('[data-act="sound"]').textContent = ctx.sound.isOn() ? '🔊 Sound ON' : '🔇 Sound OFF';
      $('[data-act="controls"]').textContent = ctx.controls.mode() === 'keyboard' ? '⌨ Keyboard' : '👆 Buttons';
      $('[data-act="lang"]').textContent = lang === 'ja' ? 'Chat: 日本語' : 'Chat: English';
    };
    const drawPresets = () => {
      if (!$('.lb-presets')) return;
      $('.lb-presets').innerHTML = PHRASES.map((_, i) => `<button type="button" data-preset="${i}">${esc(phrase(i, lang))}</button>`).join('');
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
    const drawVote = () => {
      if (!$('.lb-vote')) return;
      const r = state.room;
      const voting = r?.phase === 'voting' || r?.phase === 'decided';
      $('.lb-vote').classList.toggle('hidden', !voting);
      $('.lb-ready-btn').classList.toggle('off', voting); // コースを選んでいる間は READY を出さない
      if (!voting) return;
      $('.vote-list').innerHTML = voteRows(ctx.courses, state.votes, r.voteId, state.players);
      const left = Math.max(0, Math.ceil((r.endsAt - serverNow()) / 1000));
      $('.vote-left').textContent = r.phase === 'voting' ? `${left}` : '';
      $('.vote-picked').textContent = r.phase === 'decided' ? pickedText(ctx.courses[r.course], r.picks ?? 0, lang) : '';
    };
    const send = async (body) => {
      if (!canSend(lastSent, serverNow(), 'preset' in body ? 'preset' : 'text')) return false;
      const prev = lastSent;
      lastSent = serverNow();
      const ok = await sendChat(db, me.codeId, me, body).then(() => true, () => false);
      if (!ok) lastSent = prev; // 送れなかったら、打った文は残して、すぐ送り直せる
      return ok;
    };
    root.onclick = async (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'back') return finish('back');
      if (act === 'chars') return finish('chars');
      if (act === 'gear') return $('.lb-gear').classList.toggle('hidden');
      if (act === 'sound') ctx.sound.setOn(!ctx.sound.isOn());
      if (act === 'controls') ctx.controls.setMode(ctx.controls.mode() === 'keyboard' ? 'buttons' : 'keyboard');
      if (act === 'lang') {
        lang = lang === 'ja' ? 'en' : 'ja';
        ctx.setLang(lang);
        drawPresets();
        drawMsgs();
      }
      if (act === 'sound' || act === 'controls' || act === 'lang') return drawGear();
      if (act === 'ready') {
        if (state.room?.phase === 'voting' || state.room?.phase === 'decided') return; // 投票中は READY を押せない
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
    // 1秒に4回: 投票の残りの秒、全員 READY なら始める、締め切りなら決める、走る人が1人なら戻す
    const tick = setInterval(() => {
      const r = state.room;
      if (roomStale(r, serverNow())) resetRoom(db, r.voteId).catch(() => {}); // 止まった部屋は、走る人でなくても戻す
      else if (!r || r.phase === 'lobby') {
        if (allReady(state.players)) startVote(db, state.players, serverNow()).catch(() => {});
      } else if (r.phase === 'voting') {
        if (racersLeft(r, state.players) < 2) resetRoom(db, r.voteId).catch(() => {});
        else if (serverNow() >= r.endsAt) decideVote(db, r, state.votes, ctx.courses.length).catch(() => {});
      }
      drawVote();
    }, 250);
    offs.push(db.serverOffset((v) => { offset = v; }));
    offs.push(db.watch('lobby', (v) => { state.players = playersOf(v); drawList(); }));
    offs.push(db.watch('votes', (v) => { state.votes = v; drawVote(); }));
    offs.push(db.watch(`chat/${me.codeId}`, (v) => {
      state.msgs = lastMessages(v, CHAT_SHOW);
      const res = nextChime(chimeState, state.msgs, me.uid);
      chimeState = res.state;
      if (res.chime) ctx.chime();
      drawMsgs();
    }, { last: CHAT_SHOW }));
    offs.push(db.watch('room', async (v) => {
      if (finished) return; // 待合室を出たあとは、何もしない
      const prev = state.room;
      state.room = v;
      drawVote();
      // コースが決まった: 2秒知らせてから（M4-B では）coming soon。そのあと待合室に戻す・自分の READY を外す
      if (v?.phase === 'decided' && prev?.phase !== 'decided' && v.racers?.[me.uid]) {
        await new Promise((r) => setTimeout(r, 2000));
        if (finished) return;
        await ctx.onDecided(v.course);
        if (finished) return;
        await resetRoom(db, v.voteId).catch(() => {});
      }
      // 投票が始まったら、自分の READY を外す（決まって待合室に戻ったとき、READY が残っていて、すぐ次の投票が始まらないように）
      if (v?.phase === 'voting' && prev?.phase !== 'voting') setReady(db, me.uid, false).catch(() => {});
    }));
    offs.push(db.watch('status', (s) => {
      if (!s?.active || s.codeId !== me.codeId) finish('recode');
    }));
    enterLobby(db, me).catch(() => finish('recode'));
  });
}
