// 観客の歓声: 雑音を何層も重ねた「ワーッ」をループで流し、ときどき「ウォー！」と大きくなる
// 大きさと左右は update で毎フレーム近づける（物は作らない）
// 歓声の音のファイル（2026-10-16 にユーザーが用意。読みこめないときは、作った雑音の歓声）
export const CROWD_FILE = 'sounds/studiam.mp3';

export function createCrowd(audio, { fetch: get = (u) => fetch(u) } = {}) {
  let node = null; // { src, pan, gain, swell }
  let buffer = null;
  let fileBuffer = null;
  let boostUntil = 0;

  // 4秒の歓声（ループ）: 帯域を変えた雑音を3つ重ね、ゆっくり大きさをゆらす
  function makeBuffer(ctx) {
    const len = ctx.sampleRate * 4;
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      let low = 0;
      let mid = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        low += (w - low) * 0.02; // こもった「ワー」
        mid += (w - mid) * 0.15; // 少し明るい声のざわめき
        const t = i / ctx.sampleRate;
        // ゆれ（4秒で何回かぴったり戻る速さにして、ループのつなぎ目でとぎれない）
        const sway = 0.7 + 0.3 * Math.sin((2 * Math.PI * t * 3) / 4 + ch);
        const cheer = 0.5 + 0.5 * Math.max(0, Math.sin((2 * Math.PI * t) / 4)) ** 4; // 4秒に1回「ウォー！」
        d[i] = (low * 3 + mid * 0.8) * sway * cheer;
      }
    }
    return b;
  }

  return {
    // 音が使えるようになったあとで1回呼ぶ
    load() {
      const ctx = audio.ctx;
      if (!ctx) return Promise.resolve();
      return get(CROWD_FILE)
        .then((r) => {
          if (!r.ok) throw new Error(CROWD_FILE);
          return r.arrayBuffer();
        })
        .then((bytes) => ctx.decodeAudioData(bytes))
        .then((b) => (fileBuffer = b))
        .catch(() => {});
    },
    start() {
      const ctx = audio.ctx;
      if (!ctx || node) return;
      buffer = fileBuffer || buffer || makeBuffer(ctx);
      const src = ctx.createBufferSource();
      src.buffer = fileBuffer || buffer;
      src.loop = true;
      const pan = ctx.createStereoPanner();
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(gain).connect(pan).connect(audio.sfxOut);
      src.start();
      node = { src, pan, gain };
    },
    update({ gain, pan }) {
      if (!node) return;
      const t = audio.ctx.currentTime;
      const g = t < boostUntil ? Math.min(1, gain * 2 + 0.15) : gain;
      node.gain.gain.setTargetAtTime(g, t, 0.15);
      node.pan.pan.setTargetAtTime(pan, t, 0.15);
    },
    // 最後の周・ゴールのとき、しばらく大きく
    excite(seconds) {
      if (audio.ctx) boostUntil = audio.ctx.currentTime + seconds;
    },
    stop() {
      if (!node) return;
      node.src.stop();
      node.pan.disconnect();
      node = null;
    },
  };
}
