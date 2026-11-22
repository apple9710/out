const $ = selector => document.querySelector(selector);
const dialog = $('#dialog');
const dataKey = 'haksik-mate.meals.v1';
const myId = 'local-demo-student';
const icons = ['tray', 'bowl', 'roll'].map(name => '<img src="icons/' + name + '.svg" width="28" height="28" alt="">');
const dateFormat = new Intl.DateTimeFormat('ko-KR', {timeZone:'Asia/Seoul', month:'long', day:'numeric', weekday:'short'});
const timeFormat = new Intl.DateTimeFormat('ko-KR', {timeZone:'Asia/Seoul', hour:'numeric', minute:'2-digit'});
let filter = 'all';
let selected = null;
let toastTimer;
function koreaDate(time) {
  return new Date(time + 9 * 3600000).toISOString().slice(0, 10);
}
function mealTime(date, time) { return Date.parse(date + 'T' + time + ':00+09:00'); }
function escapeText(value) {
  const span = document.createElement('span');
  span.textContent = String(value);
  return span.innerHTML;
}
function seedMeals() {
  const samples = [
    ['학생식당', '12:30', '공강에 가볍게 점심 같이 먹어요.', ['단비','구름'], 3],
    ['교내 푸드코트', '13:00', '수업 끝나고 따뜻한 한 끼 같이해요.', ['새봄'], 4],
    ['학생회관 앞', '17:40', '저녁 메뉴 같이 고르실 분!', ['모모','보리'], 2]
  ];
  const base = Date.now() + (mealTime(koreaDate(Date.now()), '12:30') <= Date.now() ? 86400000 : 0);
  return samples.map(([place, time, intro, names, capacity], i) => ({
    id:'sample-' + i, place, at:mealTime(koreaDate(base), time), intro, capacity, icon:i,
    members:names.map((name, n) => ({id:'sample-' + i + '-' + n, name}))
  }));
}
function load() {
  const raw = localStorage.getItem(dataKey);
  if (raw) return JSON.parse(raw);
  const initial = seedMeals();
  localStorage.setItem(dataKey, JSON.stringify(initial));
  return initial;
}
const isMine = meal => meal.members.some(member => member.id === myId);
const isOpen = meal => meal.at > Date.now() && meal.members.length < meal.capacity;
const when = meal => dateFormat.format(meal.at) + ' · ' + timeFormat.format(meal.at);
function badge(meal) {
  const open = isOpen(meal);
  return '<span class="badge' + (open ? '' : ' full') + '">' + (open ? '모집 중' : '모집 마감') + '</span>';
}
function render() {
  const upcoming = load().filter(m => m.at > Date.now()).sort((a,b) => a.at - b.at);
  const mine = upcoming.filter(isMine);
  const visible = filter === 'open' ? upcoming.filter(isOpen) : filter === 'mine' ? mine : upcoming;
  $('#date').textContent = dateFormat.format(Date.now()) + ' · GLOCAL 캠퍼스';
  $('#count').textContent = visible.length;
  $('#list').innerHTML = visible.map(m => '<button class="card" data-id="' + m.id + '"><span class="tile t' + m.icon + '" aria-hidden="true">' + icons[m.icon] + '</span><span class="info"><strong>' + escapeText(m.place) + '</strong><span class="meta">' + when(m) + '</span></span><span class="capacity">' + badge(m) + '<small>' + m.members.length + ' / ' + m.capacity + '명</small></span></button>').join('') || '<p class="empty">표시할 식사 모임이 없어요.</p>';
  $('#schedule').innerHTML = mine.map(m => '<button class="slot" data-id="' + m.id + '"><small>' + when(m) + '</small><strong>' + escapeText(m.place) + '</strong></button>').join('') || '<p class="empty"><b>아직 잡힌 약속이 없어요.</b><br>모임에 참여하면 식사 시간과 장소를 여기서 확인할 수 있어요.</p>';
}
function modal(title, html) {
  $('#heading').textContent = title;
  $('#content').innerHTML = html;
  if (!dialog.open) dialog.showModal();
}
function notice(message) {
  $('#toast').textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').textContent = '', 3000);
}
const nickname = '<label>닉네임<input name="nickname" maxlength="20" required autocomplete="off" placeholder="모임에서 사용할 이름"></label>';
function createForm() {
  selected = null;
  const today = koreaDate(Date.now());
  modal('식사 모임 만들기', '<form id="new-form">' + nickname + '<label>만날 장소<input name="place" maxlength="60" required placeholder="예: 학생식당 입구"></label><div class="row"><label>식사 날짜<input name="date" type="date" value="' + today + '" min="' + today + '" required></label><label>식사 시간<input name="time" type="time" required></label></div><label>정원 (나 포함)<input name="capacity" type="number" min="2" max="30" value="3" required></label><label>모임 소개<textarea name="intro" maxlength="300" rows="2" required placeholder="어떤 식사 모임인가요?"></textarea></label><p class="error" role="alert"></p><button class="primary">모집 글 등록</button></form>');
}
function detail(id) {
  const meal = load().find(m => m.id === id);
  if (!meal) return;
  selected = id;
  const members = meal.members.map(m => escapeText(m.name)).join(' · ');
  const action = isMine(meal) ? '참여 중인 모임이에요' : isOpen(meal) ? '' : '모집이 마감됐어요';
  modal(meal.place, badge(meal) + '<p>' + when(meal) + '</p><p class="detail">' + escapeText(meal.intro) + '</p><div class="people"><strong>참여자 ' + meal.members.length + ' / ' + meal.capacity + '명</strong><p>' + members + '</p></div><form id="join-form">' + (action ? '<button type="button" class="primary" disabled>' + action + '</button>' : nickname + '<p class="error" role="alert"></p><button class="primary">이 모임 참여하기</button>') + '</form>');
}
function commit(form, fields, mealId) {
  const meals = load();
  const member = {id:myId, name:fields.nickname.trim()};
  if (!member.name) throw Error('닉네임을 입력해 주세요.');
  if (form.id === 'new-form') {
    const at = mealTime(fields.date, fields.time);
    const capacity = Number(fields.capacity);
    if (!Number.isFinite(at) || at <= Date.now()) throw Error('앞으로 만날 날짜와 시간을 선택해 주세요.');
    if (!fields.place.trim() || !fields.intro.trim()) throw Error('장소와 소개를 입력해 주세요.');
    if (!Number.isInteger(capacity) || capacity < 2 || capacity > 30) throw Error('정원은 2~30명으로 입력해 주세요.');
    meals.push({id:crypto.randomUUID(), place:fields.place.trim(), intro:fields.intro.trim(), capacity, at, icon:0, members:[member]});
  } else {
    const meal = meals.find(m => m.id === mealId);
    if (!meal || !isOpen(meal) || isMine(meal)) {
      if (meal) detail(mealId);
      throw Error('현재 참여 상태를 확인해 주세요.');
    }
    meal.members.push(member);
  }
  localStorage.setItem(dataKey, JSON.stringify(meals));
}
$('#create').onclick = createForm;
$('.close').onclick = () => dialog.close();
dialog.setAttribute('aria-labelledby', 'heading');
document.addEventListener('click', event => {
  const target = event.target.closest('button');
  if (!target) return;
  if (target.dataset.id) detail(target.dataset.id);
  if (target.dataset.filter) {
    filter = target.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach(b => b.setAttribute('aria-pressed', String(b === target)));
    render();
  }
});
dialog.addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.target;
  const fields = Object.fromEntries(new FormData(form));
  const mealId = selected;
  const submit = form.querySelector('.primary');
  submit.disabled = true;
  try {
    const write = () => commit(form, fields, mealId);
    if (navigator.locks) await navigator.locks.request(dataKey, write);
    else write();
    dialog.close();
    render();
    notice(form.id === 'new-form' ? '식사 모임을 만들었어요.' : '참여했어요. 내 식사 일정을 확인해 보세요.');
  } catch (error) {
    const box = dialog.querySelector('.error');
    if (box) box.textContent = error.message;
    else notice(error.message);
  } finally { submit.disabled = false; }
});
window.addEventListener('storage', event => { if (event.key === dataKey) { render(); if (dialog.open && selected) detail(selected); } });
render();
setInterval(render, 60000);
