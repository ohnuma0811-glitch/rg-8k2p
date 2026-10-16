// キャラの声（ジャンプ台から飛び出したときの「イヤッホー！」など）。音のファイルを読みこんで鳴らす
// 男の子のキャラは男衆「イヤッホー！」、女の子のキャラは女衆「おう！」（どちらもフリー素材。2026-10-15 のユーザー依頼）
// scream: 恐竜に食べられたときの悲鳴、roar: 恐竜が出てくるときの咆哮（どちらも ElevenLabs で作った音。2026-10-16 にユーザーが用意）
export const VOICE_FILES = { male: 'sounds/yahoo-male.mp3', female: 'sounds/yahoo-female.mp3', scream: 'sounds/dino-scream.mp3', roar: 'sounds/dino-roar.mp3' };
// 声の大きさ（女衆のファイルは男衆より 5dB ほど小さいので、大きめに鳴らす）
export const VOICE_GAIN = { male: 1, female: 1.4, scream: 1, roar: 1.2 };

export function createVoices(audio, { fetch: get = (u) => fetch(u) } = {}) {
  const bufs = {};
  return {
    // 音が使えるようになったあとで1回呼ぶ。読みこめなかった声は鳴らさないだけ
    load() {
      const ctx = audio.ctx;
      if (!ctx) return Promise.resolve();
      return Promise.all(
        Object.entries(VOICE_FILES).map(([kind, url]) =>
          get(url)
            .then((r) => {
              if (!r.ok) throw new Error(url);
              return r.arrayBuffer();
            })
            .then((bytes) => ctx.decodeAudioData(bytes))
            .then((buf) => (bufs[kind] = buf))
            .catch(() => {}),
        ),
      );
    },
    // その声のファイルを読みこめたか
    has(kind) {
      return !!bufs[kind];
    },
    play(kind) {
      const ctx = audio.ctx;
      if (!ctx || !bufs[kind]) return;
      const src = ctx.createBufferSource();
      src.buffer = bufs[kind];
      const g = ctx.createGain();
      g.gain.value = VOICE_GAIN[kind];
      src.connect(g).connect(audio.sfxOut);
      src.start(ctx.currentTime);
    },
  };
}
