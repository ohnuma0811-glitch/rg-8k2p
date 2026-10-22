// Super Kyugo & Soki Kart: TIME TRIAL のみんなの記録の置き場所（Google スプレッドシートの Apps Script）
// 使い方は docs/time-trial-ranking-setup.md（Super Kyugo＆Soki Brothers の「みんなのランキング」と同じしくみ）
// シート「times」に 1行1記録: id, course, name, character, time（秒）, date, received（届いた時刻）
var SHEET = 'times';
var HEADER = ['id', 'course', 'name', 'character', 'time', 'date', 'received'];
var CHARACTERS = ['kyugo', 'soki', 'penguin', 'rabbit', 'mouse', 'tiger', 'elephant', 'cat']; // キャラ8人（2026-10-22。src/data/characters.js と同じ）
var RANK_SIZE = 10;

function sheet_() {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  var sh = book.getSheetByName(SHEET) || book.insertSheet(SHEET);
  if (sh.getLastRow() === 0) sh.appendRow(HEADER);
  return sh;
}

function json_(v) {
  return ContentService.createTextOutput(JSON.stringify(v)).setMimeType(ContentService.MimeType.JSON);
}

function valid_(e) {
  return Boolean(e)
    && typeof e.id === 'string' && /^[A-Za-z0-9-]{8,40}$/.test(e.id)
    && typeof e.course === 'string' && e.course.length > 0 && e.course.length <= 40
    && typeof e.name === 'string' && /^[A-Z]{1,12}$/.test(e.name)
    && CHARACTERS.indexOf(e.character) >= 0
    && typeof e.time === 'number' && isFinite(e.time) && e.time > 0 && e.time < 3600
    && typeof e.date === 'string' && /^\d{2}-[A-Z][a-z]{2}-\d{2}$/.test(e.date);
}

function rows_(sh) {
  var n = sh.getLastRow() - 1;
  if (n <= 0) return [];
  return sh.getRange(2, 1, n, HEADER.length).getValues();
}

// シートの全部の行から、コースごとに速い順の上位10人（同じタイムは先に届いた方が上）。行を消せば記録からも消える
function times_(rows) {
  var out = {};
  var list = rows.map(function (r, i) {
    return { i: i, e: { id: String(r[0]), course: String(r[1]), name: String(r[2]), character: String(r[3]), time: Number(r[4]), date: String(r[5]) } };
  }).filter(function (x) { return valid_(x.e); });
  list.sort(function (a, b) { return a.e.time - b.e.time || a.i - b.i; });
  list.forEach(function (x) {
    var c = out[x.e.course] || (out[x.e.course] = []);
    if (c.length < RANK_SIZE) c.push(x.e);
  });
  return out;
}

// ゲームが記録を受け取る
function doGet() {
  return json_(times_(rows_(sheet_())));
}

// ゲームが記録を送る。同じ id は1回だけ入れる（送り直したとき）
function doPost(ev) {
  var e;
  try {
    e = JSON.parse(ev.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'json' });
  }
  if (!valid_(e)) return json_({ ok: false, error: 'invalid' });
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sh = sheet_();
    var dup = rows_(sh).some(function (r) { return String(r[0]) === e.id; });
    if (!dup) sh.appendRow([e.id, e.course, e.name, e.character, e.time, e.date, new Date()]);
  } finally {
    lock.releaseLock();
  }
  return json_({ ok: true });
}
