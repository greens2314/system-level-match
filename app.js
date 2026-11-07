'use strict';

const levelsData = [
  { id: 1, name: '一　個人工作室', definition: '單人使用，不需複雜權限', image: 'assets/images/level-1-personal-studio.webp' },
  { id: 2, name: '二　部門辦公室', definition: '多人協作，依角色分配權限', image: 'assets/images/level-2-department-office.webp' },
  { id: 3, name: '三　服務門市', definition: '對外服務，區分前台與後台', image: 'assets/images/level-3-service-storefront.webp' },
  { id: 4, name: '四　會員俱樂部', definition: '會員擁有專屬資料與使用紀錄', image: 'assets/images/level-4-members-club.webp' },
  { id: 5, name: '五　商辦大樓', definition: '多個租戶共用平台，資料彼此隔離', image: 'assets/images/level-5-multi-tenant-tower.webp' }
];

const cardsData = [
  { id: 'plumber', avatar: 0, requester: '水電行老闆', quote: '「我想要一個系統，讓客服登記報修、派工給師傅，師傅用手機回報完工。」', answer: 2, analysis: '用的人都是公司內部：客服、師傅、老闆，客人不會登入系統。', tip: '想一想，客人會登入這個系統嗎？' },
  { id: 'designer', avatar: 1, requester: '接案的設計師', quote: '「我想要一個記錄每天收支、月底自動算出總額的小工具，只有我自己用。」', answer: 1, analysis: '只有一個人用，不用分角色，先確認要做哪些功能。', tip: '想一想，這個工具有幾個人會用？' },
  { id: 'software', avatar: 2, requester: '軟體公司老闆', quote: '「我想做一套排課系統，租給全台灣的補習班用，每一家只看得到自己的資料。」', answer: 5, analysis: '每一家補習班是一個租戶，共用同一套平台，資料彼此隔離。', tip: '想一想，「每一家只看得到自己的資料」代表什麼？' },
  { id: 'county', avatar: 3, requester: '縣政府承辦', quote: '「合作的醫療院所要能線上送長者的假牙補助申請，民眾查得到案件進度，我們在後台審查、核銷。」', answer: 3, analysis: '對外開放給院所送件、民眾查進度（前台），承辦人審查與核銷（後台）。', tip: '想一想，哪些人在機關外面用、哪些人在機關裡面用？' },
  { id: 'health', avatar: 4, requester: '國健署承辦', quote: '「民眾用 App 記錄自己的健康紀錄、完成健康任務，累積健康幣來兌換獎勵。」', answer: 4, analysis: '每位會員有自己的健康紀錄與健康幣，要管怎麼累積、保存與兌換。', tip: '想一想，每個人在系統裡累積了什麼屬於自己的東西？' }
];

const levelList = document.querySelector('#levels');
const cardList = document.querySelector('#cards');
const cardsEmpty = document.querySelector('#cardsEmpty');
const message = document.querySelector('#liveMessage');
const studentNameInput = document.querySelector('#studentNameInput');
const scoreText = document.querySelector('#scoreText');
const progressText = document.querySelector('#progressText');
const progressBar = document.querySelector('#progressBar');
const resultDialog = document.querySelector('#resultDialog');
const resultSummary = document.querySelector('#resultSummary');
const answerRecord = document.querySelector('#answerRecord');
const closeResultButton = document.querySelector('#closeResultButton');
const dragGhost = document.querySelector('#dragGhost');
const nameDialog = document.querySelector('#nameDialog');
const nameForm = document.querySelector('#nameForm');
const initialNameInput = document.querySelector('#initialNameInput');
const nameError = document.querySelector('#nameError');
const STORAGE_KEY = 'system-five-level-match-record-v2';
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxoavmfqX8TFpBX5WZRoEUFKKgCMumbqPqX4vrhYqES4Bg4pSUM-0aPu29i-8S7uRJV_g/exec';

let cardOrder = [];
let matched = new Map();
let attemptStats = new Map();
let selectedCardId = null;
let mistakes = 0;
let firstWrongCards = new Set();
let studentName = '';
let pointerState = null;
let preventNextClick = false;
let submissionState = 'pending';
let gameAttemptId = createGameAttemptId();

function shuffle(items) {
  const output = [...items];
  for (let i = output.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [output[i], output[j]] = [output[j], output[i]];
  }
  return output;
}

function cardById(id) { return cardsData.find((card) => card.id === id); }
function directQuote(quote) { return quote.replace(/^「/, '').replace(/」$/, ''); }
function isMatched(cardId) { return [...matched.values()].includes(cardId); }
function currentScore() { return 100 - (firstWrongCards.size * 10); }
function createGameAttemptId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function wasPageReloaded() {
  const navigation = performance.getEntriesByType?.('navigation')?.[0];
  return navigation?.type === 'reload' || performance.navigation?.type === 1;
}

function clearSavedState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    // 瀏覽器禁止本機儲存時，沒有可清除的紀錄。
  }
}

function setMessage(text, type = '') {
  message.textContent = text;
  message.className = `live-message${type ? ` is-${type}` : ''}`;
}

function renderLevels() {
  levelList.innerHTML = levelsData.map((level) => {
    const cardId = matched.get(level.id);
    const matchedCard = cardId ? cardById(cardId) : null;
    return `
      <article class="level${matchedCard ? ' is-matched' : ''}" data-level-id="${level.id}" tabindex="0" role="button" aria-label="${level.name}，可放入需求卡">
        <div class="level-visual">
          <img src="${level.image}" alt="${level.name}的主題插圖">
          <span class="level-number" aria-hidden="true">${level.id}</span>
        </div>
        <div class="level-content">
          <h3 class="level-title">${level.name}</h3>
          <p class="level-definition">${level.definition}</p>
          ${matchedCard
            ? `<div class="matched-card">${matchedCard.requester}</div><p class="analysis"><strong>解析：</strong>${matchedCard.analysis}</p><span class="success-stamp" aria-hidden="true">配對成功</span>`
            : '<span class="drop-hint">把對應的需求卡放到這裡</span>'}
        </div>
      </article>`;
  }).join('');

  levelList.querySelectorAll('.level').forEach((level) => {
    level.addEventListener('click', () => {
      if (preventNextClick) return;
      if (selectedCardId) attemptMatch(selectedCardId, Number(level.dataset.levelId));
      else setMessage('請先從左邊選一張需求卡。');
    });
    level.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        level.click();
      }
    });
  });
}

function renderCards() {
  const pending = cardOrder.filter((id) => !isMatched(id));
  cardList.innerHTML = pending.map((id) => {
    const card = cardById(id);
    const quote = directQuote(card.quote);
    return `
      <article class="request-card${selectedCardId === card.id ? ' is-selected' : ''}" data-card-id="${card.id}" tabindex="0" role="button" aria-label="需求方：${card.requester}。${quote}">
        <div class="avatar avatar-${card.avatar}" aria-hidden="true"></div>
        <div>
          <span class="request-card__label">需求方：${card.requester}</span>
          <p class="request-card__quote">${quote}</p>
        </div>
      </article>`;
  }).join('');
  cardsEmpty.hidden = pending.length !== 0;

  cardList.querySelectorAll('.request-card').forEach((cardElement) => {
    cardElement.addEventListener('click', () => {
      if (preventNextClick) {
        preventNextClick = false;
        return;
      }
      selectCard(cardElement.dataset.cardId);
    });
    cardElement.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectCard(cardElement.dataset.cardId);
      }
    });
    cardElement.addEventListener('pointerdown', startPointerDrag);
  });
}

function updateProgress() {
  const completed = matched.size;
  progressText.textContent = `完成 ${completed} / 5`;
  progressBar.style.width = `${completed * 20}%`;
  scoreText.textContent = currentScore();
}

function render() {
  renderLevels();
  renderCards();
  updateProgress();
}

function setStudentName(name) {
  studentName = name.trim();
  studentNameInput.value = studentName;
  initialNameInput.value = studentName;
  studentNameInput.readOnly = Boolean(studentName);
}

function buildResultPayload() {
  return {
    studentName,
    score: currentScore(),
    totalWrongAttempts: mistakes,
    retries: Object.fromEntries(cardsData.map((card) => [
      card.id,
      attemptStats.get(card.id)?.wrongCount ?? 0
    ]))
  };
}

function submitResultOnce() {
  if (
    submissionState === 'sent' ||
    !GOOGLE_SCRIPT_URL ||
    !studentName ||
    matched.size !== cardsData.length
  ) return;

  const submittedAttemptId = gameAttemptId;
  submissionState = 'sending';
  saveState();

  fetch(GOOGLE_SCRIPT_URL, {
    method: 'POST',
    mode: 'no-cors',
    keepalive: true,
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(buildResultPayload())
  })
    .then(() => {
      if (gameAttemptId !== submittedAttemptId) return;
      submissionState = 'sent';
      saveState();
    })
    .catch(() => {
      if (gameAttemptId !== submittedAttemptId) return;
      submissionState = 'pending';
      saveState();
    });
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      studentName,
      cardOrder,
      matched: [...matched.entries()],
      attemptStats: [...attemptStats.entries()],
      firstWrongCardIds: [...firstWrongCards],
      submissionState,
      gameAttemptId
    }));
  } catch (error) {
    // 若瀏覽器禁止本機儲存，仍可完成遊戲，但重新整理後無法還原。
  }
}

function restoreState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!stored || typeof stored.studentName !== 'string' || !Array.isArray(stored.matched)) return false;

    const validCardIds = new Set(cardsData.map((card) => card.id));
    const validLevelIds = new Set(levelsData.map((level) => level.id));
    const restoredMatches = new Map();
    const usedCards = new Set();
    stored.matched.forEach((entry) => {
      const levelId = Number(entry?.[0]);
      const cardId = entry?.[1];
      const card = cardById(cardId);
      if (validLevelIds.has(levelId) && validCardIds.has(cardId) && card?.answer === levelId && !restoredMatches.has(levelId) && !usedCards.has(cardId)) {
        restoredMatches.set(levelId, cardId);
        usedCards.add(cardId);
      }
    });
    const savedOrder = Array.isArray(stored.cardOrder) ? stored.cardOrder.filter((id) => validCardIds.has(id)) : [];
    cardOrder = new Set(savedOrder).size === cardsData.length ? savedOrder : shuffle(cardsData.map((card) => card.id));
    matched = restoredMatches;
    attemptStats = new Map();
    if (Array.isArray(stored.attemptStats)) {
      stored.attemptStats.forEach((entry) => {
        const cardId = entry?.[0];
        const wrongCount = Number(entry?.[1]?.wrongCount);
        if (validCardIds.has(cardId) && Number.isInteger(wrongCount) && wrongCount > 0) {
          attemptStats.set(cardId, { wrongCount });
        }
      });
    }
    firstWrongCards = new Set([...attemptStats.keys()]);
    mistakes = [...attemptStats.values()].reduce((total, stat) => total + stat.wrongCount, 0);
    submissionState = stored.submissionState === 'sent' ? 'sent' : 'pending';
    gameAttemptId = typeof stored.gameAttemptId === 'string' && stored.gameAttemptId
      ? stored.gameAttemptId
      : createGameAttemptId();
    setStudentName(stored.studentName);
    return Boolean(studentName);
  } catch (error) {
    return false;
  }
}

function openNameDialog() {
  nameError.hidden = true;
  if (typeof nameDialog.showModal === 'function') nameDialog.showModal();
  else nameDialog.setAttribute('open', '');
  window.setTimeout(() => initialNameInput.focus(), 80);
}

function selectCard(id) {
  if (selectedCardId === id) {
    selectedCardId = null;
    setMessage('已取消選擇，請再挑一張需求卡。');
  } else {
    selectedCardId = id;
    setMessage('已選取需求卡。把它拖到你認為對的建築。');
  }
  renderCards();
}

function attemptMatch(cardId, levelId) {
  const card = cardById(cardId);
  const target = levelList.querySelector(`[data-level-id="${levelId}"]`);
  if (!card || !target || isMatched(card.id)) return;

  if (card.answer === levelId) {
    matched.set(levelId, card.id);
    selectedCardId = null;
    setMessage(`答對了！「${card.requester}」的需求已送進正確建築，看看下方解析。`, 'success');
    saveState();
    render();
    if (matched.size === cardsData.length) {
      submitResultOnce();
      window.setTimeout(showResult, 620);
    }
    return;
  }

  const stats = attemptStats.get(card.id) ?? { wrongCount: 0 };
  stats.wrongCount += 1;
  attemptStats.set(card.id, stats);
  mistakes += 1;
  const firstWrong = !firstWrongCards.has(card.id);
  if (firstWrong) firstWrongCards.add(card.id);
  selectedCardId = null;
  setMessage(firstWrong
    ? `還差一點，這張卡第一次答錯，扣 10 分。提示：${card.tip}`
    : `再想一下，這張卡已扣過分，可以繼續嘗試。提示：${card.tip}`, 'error');
  saveState();
  target.classList.remove('is-wrong');
  void target.offsetWidth;
  target.classList.add('is-wrong');
  window.setTimeout(() => target.classList.remove('is-wrong'), 520);
  renderCards();
  updateProgress();
}

function startPointerDrag(event) {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  const cardElement = event.currentTarget;
  pointerState = { id: cardElement.dataset.cardId, element: cardElement, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, dragging: false };
  cardElement.setPointerCapture?.(event.pointerId);
  window.addEventListener('pointermove', movePointerDrag);
  window.addEventListener('pointerup', endPointerDrag, { once: true });
  window.addEventListener('pointercancel', cancelPointerDrag, { once: true });
}

function movePointerDrag(event) {
  if (!pointerState || event.pointerId !== pointerState.pointerId) return;
  const distance = Math.hypot(event.clientX - pointerState.startX, event.clientY - pointerState.startY);
  if (!pointerState.dragging && distance > 8) {
    pointerState.dragging = true;
    selectedCardId = pointerState.id;
    pointerState.element.classList.add('is-dragging');
    dragGhost.innerHTML = pointerState.element.outerHTML;
    dragGhost.classList.add('is-active');
    document.body.style.cursor = 'grabbing';
  }
  if (!pointerState.dragging) return;
  event.preventDefault();
  dragGhost.style.left = `${event.clientX}px`;
  dragGhost.style.top = `${event.clientY}px`;
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.level');
  levelList.querySelectorAll('.level').forEach((level) => level.classList.toggle('is-target', level === target));
}

function endPointerDrag(event) {
  if (!pointerState) return;
  const state = pointerState;
  cleanupPointerDrag();
  if (!state.dragging) return;
  preventNextClick = true;
  window.setTimeout(() => { preventNextClick = false; }, 0);
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.level');
  if (target) attemptMatch(state.id, Number(target.dataset.levelId));
  else {
    selectedCardId = null;
    setMessage('需求卡回到左邊。重新選擇後再拖一次。');
    renderCards();
  }
}

function cancelPointerDrag() { cleanupPointerDrag(); }

function cleanupPointerDrag() {
  if (pointerState?.element) pointerState.element.classList.remove('is-dragging');
  pointerState = null;
  dragGhost.classList.remove('is-active');
  dragGhost.innerHTML = '';
  document.body.style.cursor = '';
  levelList.querySelectorAll('.level').forEach((level) => level.classList.remove('is-target'));
  window.removeEventListener('pointermove', movePointerDrag);
}

function showResult() {
  const studentPrefix = studentName ? `${studentName}同學｜` : '';
  resultSummary.textContent = mistakes === 0
    ? `${studentPrefix}本次得分：100／100 分，完全沒有答錯！`
    : `${studentPrefix}本次得分：${currentScore()}／100 分，共答錯 ${mistakes} 次。`;
  answerRecord.innerHTML = `
    <div class="answer-record__heading"><span>需求方</span><span>配對等級</span><span>結果</span></div>
    ${cardsData.map((card) => {
      const level = levelsData.find((item) => item.id === card.answer);
      const wrongCount = attemptStats.get(card.id)?.wrongCount ?? 0;
      const result = wrongCount ? `答對・重試 ${wrongCount} 次・10 分` : '答對・20 分';
      return `<div class="answer-record__row"><span>${card.requester}</span><span>${level?.name ?? ''}</span><span class="answer-record__result is-correct">${result}</span></div>`;
    }).join('')}`;
  if (!resultDialog.open && typeof resultDialog.showModal === 'function') resultDialog.showModal();
  else if (!resultDialog.open) resultDialog.setAttribute('open', '');
}

function startFreshGame() {
  cardOrder = shuffle(cardsData.map((card) => card.id));
  matched = new Map();
  attemptStats = new Map();
  selectedCardId = null;
  mistakes = 0;
  firstWrongCards = new Set();
  submissionState = 'pending';
  gameAttemptId = createGameAttemptId();
  setMessage('左邊選一張，拖到右邊對應的建築。');
}

nameForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const enteredName = initialNameInput.value.trim();
  if (!enteredName) {
    nameError.hidden = false;
    initialNameInput.focus();
    return;
  }
  setStudentName(enteredName);
  saveState();
  if (typeof nameDialog.close === 'function') nameDialog.close();
  else nameDialog.removeAttribute('open');
});

nameDialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  initialNameInput.focus();
});

closeResultButton.addEventListener('click', () => {
  if (typeof resultDialog.close === 'function') resultDialog.close();
  else resultDialog.removeAttribute('open');
});

if (wasPageReloaded()) {
  clearSavedState();
  startFreshGame();
  render();
  openNameDialog();
} else if (restoreState()) {
  render();
  if (matched.size === cardsData.length) {
    window.setTimeout(() => {
      submitResultOnce();
      showResult();
    }, 180);
  }
} else {
  startFreshGame();
  render();
  openNameDialog();
}
