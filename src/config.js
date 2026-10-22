// TIME TRIAL のみんなの記録の置き場所（Google スプレッドシートの Apps Script を「ウェブアプリ」として公開した URL）。
// 空のときは、その端末だけの記録。設定のしかたは docs/time-trial-ranking-setup.md
export const TIMES_URL = 'https://script.google.com/macros/s/AKfycbw0ORvH1sVIjiBjWSFFpfqX1bXg8bki58d2wfHq1MQ7VOCEnkLg5yi2TgkfrNboV_Or/exec';

// Firebase（対戦と GM 画面。設計書 docs/superpowers/specs/2026-10-22-gamecode-design.md）。ウェブで使う値は公開してよい（守りはルール）。
// 空のときは、対戦のボタンで「Not set up yet」と出すだけ（SOLO・TIME TRIAL はそのまま）。設定のしかたは docs/firebase-setup.md
export const FIREBASE = {
  apiKey: '',
  authDomain: '',
  databaseURL: '',
  projectId: '',
  appId: '',
};
