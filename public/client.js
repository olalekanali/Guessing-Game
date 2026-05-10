const socket = io();

const chat = document.getElementById('chat');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const playersDiv = document.getElementById('players');
const scoreboardDiv = document.getElementById('scoreboard');
const questionBox = document.getElementById('question-box');
const guessForm = document.getElementById('guess-form');
const guessInput = document.getElementById('guess-input');
const joinForm = document.getElementById('join-form');
const usernameInput = document.getElementById('username-input');
const startBtn = document.getElementById('start-btn');
const createQForm = document.getElementById('create-question-form');
const questionInput = document.getElementById('question-input');
const answerInput = document.getElementById('answer-input');
const sessionForm = document.getElementById('session-form');
const usernameSessionInput = document.getElementById('username-session-input');
const createSessionBtn = document.getElementById('create-session-btn');
const joinSessionBtn = document.getElementById('join-session-btn');
const joinCodeInput = document.getElementById('join-code-input');
const sessionLinkDiv = document.getElementById('session-link');
const stateMessage = document.getElementById('state-message');
const winnerMessage = document.getElementById('winner-message');
const errorMessage = document.getElementById('error-message');
const questionProgress = document.getElementById('question-progress');
const questionQueue = document.getElementById('question-queue');
const skipBtn = document.getElementById('skip-btn');

let username = '';
let isGameMaster = false;
let gameActive = false;
let currentCode = (window.INITIAL_GAME_CODE || '').trim().toLowerCase();

function showError(message) {
  errorMessage.innerText = message;
  errorMessage.style.display = message ? 'block' : 'none';
}

function clearError() {
  showError('');
}

function showGameMain() {
  document.getElementById('game-main').style.display = 'block';
}

if (joinCodeInput && currentCode) {
  joinCodeInput.value = currentCode;
  stateMessage.innerText = `Join game ${currentCode} with your name.`;
}

// Session creation and join
if (sessionForm) {
  createSessionBtn.addEventListener('click', () => {
    username = usernameSessionInput.value.trim();
    if (username) {
      clearError();
      socket.emit('create-session', { username });
    } else {
      showError('Enter your name before creating a game.');
    }
  });
  joinSessionBtn.addEventListener('click', () => {
    username = usernameSessionInput.value.trim();
    const code = joinCodeInput.value.trim().toLowerCase();
    if (username && code) {
      clearError();
      socket.emit('join-session', { username, code });
    } else {
      showError('Enter your name and game code to join.');
    }
  });
}

socket.on('session-created', ({ code, link }) => {
  currentCode = code;
  sessionForm.style.display = 'none';
  sessionLinkDiv.style.display = 'block';
  sessionLinkDiv.innerHTML = `Share this link on the same device/browser host: <b>${window.location.origin}${link}</b> <br>Game code: <b>${code}</b>`;
  showGameMain();
  stateMessage.innerText = 'Waiting for players and questions...';
  clearError();
});

socket.on('session-joined', ({ code }) => {
  currentCode = code;
  sessionForm.style.display = 'none';
  showGameMain();
  stateMessage.innerText = 'Joined game. Waiting for the game master to start.';
  clearError();
});

socket.on('session-error', ({ message }) => {
  showError(message);
});

// Chat
if (chatForm) {
  chatForm.addEventListener('submit', e => {
    e.preventDefault();
    const msg = chatInput.value.trim();
    if (msg) {
      socket.emit('chat', msg);
      chatInput.value = '';
    }
  });
}

// Guess
if (guessForm) {
  guessForm.addEventListener('submit', e => {
    e.preventDefault();
    if (!gameActive) return;
    const guess = guessInput.value.trim();
    if (guess) {
      socket.emit('guess', guess);
      guessInput.value = '';
    }
  });
}

// Create question (game master)
if (createQForm) {
  createQForm.addEventListener('submit', e => {
    e.preventDefault();
    const question = questionInput.value.trim();
    const answer = answerInput.value.trim();
    if (question && answer) {
      clearError();
      socket.emit('create-question', { question, answer });
      questionInput.value = '';
      answerInput.value = '';
    } else {
      showError('Enter both a question and answer.');
    }
  });
}

if (startBtn) {
  startBtn.addEventListener('click', () => {
    clearError();
    socket.emit('start-game');
  });
}

if (skipBtn) {
  skipBtn.addEventListener('click', () => {
    if (!gameActive) return;
    socket.emit('skip-question');
  });
}

// Socket events
socket.on('chat', ({ user, msg }) => {
  const div = document.createElement('div');
  div.innerHTML = `<strong>${user}:</strong> ${msg}`;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
});

socket.on('players', (players) => {
  playersDiv.innerHTML = `<strong>Players (${players.length}):</strong> ` + players.map(p => p.username + (p.isGameMaster ? ' 👑' : '')).join(', ');
});

socket.on('scoreboard', (scores) => {
  scoreboardDiv.innerHTML = '<strong>Scores:</strong> ' + scores.map(s => `${s.username}: ${s.score}`).join(', ');
});

socket.on('question', ({ prompt, index, total }) => {
  questionProgress.innerHTML = total ? `Question ${index} of ${total}` : '';
  questionBox.innerHTML = `<strong>Question:</strong> ${prompt}`;
  if (!isGameMaster) {
    skipBtn.style.display = gameActive ? 'inline-block' : 'none';
  }
});

socket.on('question-queue', ({ total, nextIndex, questions }) => {
  if (!isGameMaster) return;
  questionQueue.style.display = 'block';
  if (!total) {
    questionQueue.innerHTML = 'No questions added yet.';
    return;
  }
  const nextLabel = nextIndex > 0 ? `Next live question: ${nextIndex} of ${total}` : `Ready to start with ${total} question${total === 1 ? '' : 's'}.`;
  questionQueue.innerHTML = `<strong>Question Queue:</strong> ${questions.join(' | ')}<br>${nextLabel}`;
});

socket.on('game-master', () => {
  isGameMaster = true;
  createQForm.style.display = 'block';
  startBtn.style.display = 'block';
  questionQueue.style.display = 'block';
  skipBtn.style.display = 'none';
});

socket.on('game-started', () => {
  guessForm.style.display = 'block';
  createQForm.style.display = 'none';
  startBtn.style.display = 'none';
  winnerMessage.innerText = '';
  gameActive = true;
  stateMessage.innerText = 'Game in progress';
  if (!isGameMaster) {
    skipBtn.style.display = 'inline-block';
  }
});

socket.on('round-ended', ({ winner, answer, reason, hasNext }) => {
  guessForm.style.display = 'none';
  skipBtn.style.display = 'none';
  gameActive = false;
  if (winner) {
    questionBox.innerHTML = `<strong>${winner}</strong> answered correctly. <br><strong>Answer:</strong> ${answer}`;
  } else if (reason === 'skipped') {
    questionBox.innerHTML = `<strong>Question skipped by all players.</strong> <br><strong>Answer:</strong> ${answer}`;
  } else {
    questionBox.innerHTML = `<strong>No correct answer.</strong> <br><strong>Answer:</strong> ${answer}`;
  }
  stateMessage.innerText = hasNext ? 'Loading next question...' : 'Game finished.';
});

socket.on('game-ended', ({ winner, answer }) => {
  guessForm.style.display = 'none';
  skipBtn.style.display = 'none';
  gameActive = false;
  if (winner) {
    questionBox.innerHTML = `<strong>Winner:</strong> ${winner} <br><strong>Answer:</strong> ${answer}`;
  } else {
    questionBox.innerHTML = answer
      ? `<strong>Game over.</strong> Final answer was: ${answer}`
      : '<strong>Game over.</strong>';
  }
  stateMessage.innerText = 'Waiting for players and questions...';
  if (isGameMaster) {
    createQForm.style.display = 'block';
    startBtn.style.display = 'block';
  }
});

socket.on('attempts', (attemptsLeft) => {
  const currentHTML = questionBox.innerHTML;
  const noAttemptsMsg = currentHTML.includes('Attempts left:') 
    ? currentHTML.split('<br><strong>Attempts left:')[0]
    : currentHTML;
  questionBox.innerHTML = noAttemptsMsg + `<br><strong>Attempts left:</strong> ${attemptsLeft}`;
});

socket.on('game-state', (msg) => {
  stateMessage.innerText = msg;
});

socket.on('winner-message', (msg) => {
  winnerMessage.innerText = msg;
});
