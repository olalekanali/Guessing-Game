const socket = io();

// UI Elements
const chat = document.getElementById('chat');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const playersDiv = document.getElementById('players');
const playersList = document.getElementById('players-list');
const scoreboardDiv = document.getElementById('scoreboard');
const scoreboardList = document.getElementById('scoreboard-list');
const questionBox = document.getElementById('question-box');
const guessForm = document.getElementById('guess-form');
const guessInput = document.getElementById('guess-input');
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
const timerDisplay = document.getElementById('timer-display');
const masterControls = document.getElementById('master-controls');
const playerControls = document.getElementById('player-controls');
const gameMain = document.getElementById('game-main');

let username = '';
let isGameMaster = false;
let gameActive = false;
let currentCode = (window.INITIAL_GAME_CODE || '').trim().toLowerCase();
let timerInterval = null;

function showError(message) {
  errorMessage.innerText = message;
  errorMessage.style.display = message ? 'block' : 'none';
}

function clearError() {
  showError('');
}

function showGameMain() {
  gameMain.style.display = 'block';
}

function hideGameMain() {
  gameMain.style.display = 'none';
}

function startTimer(duration) {
  let timeLeft = duration;
  timerDisplay.classList.add('active');
  timerDisplay.innerText = `⏱️ Time: ${timeLeft}s`;

  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeLeft--;
    timerDisplay.innerText = `⏱️ Time: ${timeLeft}s`;
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      timerDisplay.classList.remove('active');
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerDisplay.classList.remove('active');
  timerDisplay.innerText = '';
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
  sessionLinkDiv.innerHTML = `
    <div style="margin-bottom:12px;">
      <strong>✅ Game Created!</strong><br>
      Share this link: <code style="background:#f0f0f0;padding:4px 8px;border-radius:4px;">${window.location.origin}${link}</code><br>
      Game code: <strong>${code}</strong>
    </div>
  `;
  showGameMain();
  stateMessage.innerText = '⏳ Waiting for players and questions...';
  clearError();
});

socket.on('session-joined', ({ code }) => {
  currentCode = code;
  sessionForm.style.display = 'none';
  showGameMain();
  stateMessage.innerText = '⏳ Joined! Waiting for the game master to start...';
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
  if (!playersList) return;
  playersList.innerHTML = players.map(p => 
    `<div class="player-item">
      <span class="player-name">${p.username}</span>
      ${p.isGameMaster ? '<span class="player-badge">👑 Master</span>' : ''}
    </div>`
  ).join('');
  
  // Update state message with player count
  stateMessage.innerText = `${players.length} player${players.length !== 1 ? 's' : ''} in game`;
});

socket.on('scoreboard', (scores) => {
  if (!scoreboardList) return;
  scoreboardList.innerHTML = scores.map(s => 
    `<div class="score-item">
      <span>${s.username}</span>
      <span class="score-value">${s.score} pts</span>
    </div>`
  ).join('');
});

socket.on('question', ({ prompt, index, total }) => {
  questionProgress.innerHTML = total ? `Question ${index} of ${total}` : '';
  questionBox.innerHTML = `<strong>❓ Question:</strong> ${prompt}`;
  if (!isGameMaster) {
    skipBtn.style.display = gameActive ? 'inline-block' : 'none';
  }
});

socket.on('question-queue', ({ total, nextIndex, questions }) => {
  if (!isGameMaster) return;
  if (!total) {
    questionQueue.innerHTML = '📋 No questions added yet.';
    return;
  }
  const nextLabel = nextIndex > 0 ? `Next question: ${nextIndex} of ${total}` : `Ready with ${total} question${total === 1 ? '' : 's'}!`;
  questionQueue.innerHTML = `<strong>📋 Question Queue:</strong><br>${questions.join('<br>')}<br><br><em>${nextLabel}</em>`;
});

socket.on('game-master', () => {
  isGameMaster = true;
  masterControls.style.display = 'block';
  playerControls.style.display = 'none';
  questionQueue.style.display = 'block';
  skipBtn.style.display = 'none';
  stateMessage.innerText = '👑 You are the game master! Add questions and start the game.';
});

socket.on('game-started', ({ timerDuration }) => {
  playerControls.style.display = 'block';
  masterControls.style.display = 'none';
  startBtn.style.display = 'none';
  winnerMessage.innerText = '';
  gameActive = true;
  stateMessage.innerText = '🎮 Game in progress!';
  if (!isGameMaster) {
    skipBtn.style.display = 'inline-block';
  }
  if (timerDuration) {
    startTimer(timerDuration);
  }
});

socket.on('round-ended', ({ winner, answer, reason, hasNext }) => {
  guessForm.style.display = 'none';
  skipBtn.style.display = 'none';
  gameActive = false;
  stopTimer();
  
  let message = '';
  if (winner) {
    message = `✅ <strong>${winner}</strong> answered correctly!<br><strong>Answer:</strong> ${answer}`;
  } else if (reason === 'skipped') {
    message = `⏭️ <strong>Question skipped by all players.</strong><br><strong>Answer:</strong> ${answer}`;
  } else {
    message = `❌ <strong>No correct answer.</strong><br><strong>Answer:</strong> ${answer}`;
  }
  
  questionBox.innerHTML = message;
  stateMessage.innerText = hasNext ? '⏳ Loading next question...' : '🏁 Game finished!';
});

socket.on('game-ended', ({ winner, answer }) => {
  guessForm.style.display = 'none';
  skipBtn.style.display = 'none';
  gameActive = false;
  stopTimer();
  
  if (winner) {
    questionBox.innerHTML = `🏆 <strong>Final Winner:</strong> ${winner}<br><strong>Answer was:</strong> ${answer}`;
  } else {
    questionBox.innerHTML = answer
      ? `🎮 <strong>Game Over.</strong> Final answer was: ${answer}`
      : '<strong>Game Over.</strong>';
  }
  
  stateMessage.innerText = '⏳ Waiting for next round...';
  if (isGameMaster) {
    masterControls.style.display = 'block';
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
