import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { Server } from 'socket.io';
import connectDB from './src/config/db.config.js';
import { v4 as uuidv4 } from 'uuid';
import GameSession from './src/models/GameSession.js';
import User from './src/models/User.js';

dotenv.config();
await connectDB();
await GameSession.collection.updateMany(
  { $or: [{ code: null }, { code: { $exists: false } }] },
  [
    {
      $set: {
        code: {
          $concat: [
            'legacy-',
            { $substrBytes: [{ $toString: '$_id' }, 18, 6] },
          ],
        },
      },
    },
  ]
);
await Promise.all([GameSession.syncIndexes(), User.syncIndexes()]);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Home route
app.get('/', (req, res) => {
  res.render('index');
});

// Serve game session by code
app.get('/game/:code', (req, res) => {
  const { code } = req.params;
  res.render('index', { code });
});

// In-memory socket-to-user/session mapping
let socketUserMap = {};
let socketSessionMap = {};
const sessionTimers = {};

function normalizeCode(code = '') {
  return code.trim().toLowerCase();
}

function getCurrentQuestion(session) {
  if (!session || session.currentQuestionIndex < 0) return null;
  return session.questions[session.currentQuestionIndex] || null;
}

function getEligiblePlayers(session) {
  return session.players.filter(player => !player.isGameMaster);
}

function clearSessionTimer(sessionCode) {
  if (sessionTimers[sessionCode]) {
    clearTimeout(sessionTimers[sessionCode]);
    delete sessionTimers[sessionCode];
  }
}

function resetAttemptsForRound(session) {
  session.attempts = new Map();
  session.skippedBy = [];
  session.players.forEach((player) => {
    if (!player.isGameMaster) {
      session.attempts.set(player.username, 3);
    }
  });
}

async function emitSessionRoster(sessionCode) {
  const session = await GameSession.findOne({ code: sessionCode }).populate('players');
  if (!session) return;
  const players = session.players.map((player) => ({
    username: player.username,
    isGameMaster: player.isGameMaster,
  }));
  const scoreboard = session.players.map((player) => ({
    username: player.username,
    score: session.scores?.get(player.username) || 0,
  }));
  broadcastToSession(sessionCode, 'players', players);
  broadcastToSession(sessionCode, 'scoreboard', scoreboard);
}

async function emitQuestionQueue(sessionCode) {
  const session = await GameSession.findOne({ code: sessionCode });
  if (!session) return;
  const questions = session.questions.map((item, index) => `${index + 1}. ${item.prompt}`);
  broadcastToSession(sessionCode, 'question-queue', {
    total: session.questions.length,
    nextIndex: session.isActive && session.currentQuestionIndex >= 0 ? session.currentQuestionIndex + 1 : 0,
    questions,
  });
}

async function sendCurrentQuestion(sessionCode) {
  const session = await GameSession.findOne({ code: sessionCode }).populate('players');
  if (!session || !session.isActive) return;
  const currentQuestion = getCurrentQuestion(session);
  if (!currentQuestion) return;
  // Shuffle options if they exist
  let shuffledOptions = [];
  if (currentQuestion.options && currentQuestion.options.length > 0) {
    shuffledOptions = [...currentQuestion.options].sort(() => Math.random() - 0.5);
  }
  
  broadcastToSession(sessionCode, 'question', {
    prompt: currentQuestion.prompt,
    options: shuffledOptions,
    index: session.currentQuestionIndex + 1,
    total: session.questions.length,
  });
  broadcastToSession(sessionCode, 'game-started', { timerDuration: session.timer });
  broadcastToSession(sessionCode, 'game-state', 'Game in progress');
  clearSessionTimer(sessionCode);
  sessionTimers[sessionCode] = setTimeout(async () => {
    const activeSession = await GameSession.findOne({ code: sessionCode }).populate('players');
    if (!activeSession || !activeSession.isActive) return;
    await finishRound(activeSession, null, 'timeout');
  }, session.timer * 1000);
}

async function finishRound(session, winnerUser, reason = 'correct') {
  const sessionCode = session.code;
  const currentQuestion = getCurrentQuestion(session);
  if (!currentQuestion) return;

  clearSessionTimer(sessionCode);

  if (winnerUser) {
    session.winner = winnerUser.username;
    session.scores.set(
      winnerUser.username,
      (session.scores.get(winnerUser.username) || 0) + 10
    );
  } else {
    session.winner = null;
  }

  const hasNextQuestion = session.currentQuestionIndex + 1 < session.questions.length;
  session.isActive = hasNextQuestion;

  broadcastToSession(sessionCode, 'round-ended', {
    winner: winnerUser ? winnerUser.username : null,
    answer: currentQuestion.answer,
    reason,
    hasNext: hasNextQuestion,
  });

  if (winnerUser?.socketId && io.sockets.sockets.get(winnerUser.socketId)) {
    io.to(winnerUser.socketId).emit('winner-message', 'You answered correctly!');
  }

  if (!hasNextQuestion) {
    session.endedAt = new Date();
    session.questions = []; // Clear questions for next game master
    session.currentQuestionIndex = -1;
    await session.save();
    await emitSessionRoster(sessionCode);
    broadcastToSession(sessionCode, 'game-ended', {
      winner: winnerUser ? winnerUser.username : null,
      answer: currentQuestion.answer,
    });
    broadcastToSession(sessionCode, 'game-state', 'Game finished! New game master can add questions and restart.');
    await emitQuestionQueue(sessionCode);
    return;
  }

  session.currentQuestionIndex += 1;
  resetAttemptsForRound(session);
  await session.save();
  await emitSessionRoster(sessionCode);
  await emitQuestionQueue(sessionCode);

  setTimeout(async () => {
    await sendCurrentQuestion(sessionCode);
  }, 1500);
}

// Helper: broadcast to a session
async function broadcastToSession(sessionCode, event, data) {
  const session = await GameSession.findOne({ code: sessionCode }).populate('players');
  if (!session) return;
  session.players.forEach(player => {
    const socketId = player.socketId;
    if (socketId && io.sockets.sockets.get(socketId)) {
      io.to(socketId).emit(event, data);
    }
  });
}


io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Game master creates a new session
  socket.on('create-session', async ({ username }) => {
    if (!username) return;
    const code = normalizeCode(uuidv4().slice(0, 6));
    const user = new User({ username, isGameMaster: true });
    await user.save();
    const session = new GameSession({
      code,
      master: user._id,
      players: [user._id],
      isActive: false,
      scores: new Map([[username, 0]]),
    });
    await session.save();
    user.sessionId = session._id;
    user.socketId = socket.id;
    await user.save();
    socketUserMap[socket.id] = user._id;
    socketSessionMap[socket.id] = code;
    socket.join(code);
    socket.emit('session-created', { code, link: `/game/${code}` });
    await emitSessionRoster(code);
    await emitQuestionQueue(code);
    socket.emit('game-master');
  });

  // Player joins a session by code
  socket.on('join-session', async ({ username, code }) => {
    const normalizedCode = normalizeCode(code);
    if (!username || !normalizedCode) {
      socket.emit('session-error', { message: 'Enter your name and a valid game code.' });
      return;
    }
    const session = await GameSession.findOne({ code: normalizedCode }).populate('players');
    if (!session) {
      socket.emit('session-error', { message: 'Game not found. Check the code or link and try again.' });
      return;
    }
    if (session.isActive) {
      socket.emit('session-error', { message: 'Game is already in progress. You cannot join now.' });
      return;
    }
    if (session.players.find(p => p.username.toLowerCase() === username.toLowerCase())) {
      socket.emit('session-error', { message: 'That name is already in this game. Choose another one.' });
      return;
    }
    const user = new User({ username, isGameMaster: false, sessionId: session._id, socketId: socket.id });
    await user.save();
    session.players.push(user._id);
    session.scores.set(username, 0);
    await session.save();
    socketUserMap[socket.id] = user._id;
    socketSessionMap[socket.id] = normalizedCode;
    socket.join(normalizedCode);
    socket.emit('session-joined', { code: normalizedCode });
    await emitSessionRoster(normalizedCode);
    await emitQuestionQueue(normalizedCode);
  });

  // Chat
  socket.on('chat', async (msg) => {
    const userId = socketUserMap[socket.id];
    if (!userId) return;
    const user = await User.findById(userId);
    const code = socketSessionMap[socket.id];
    if (!user || !code) return;
    broadcastToSession(code, 'chat', { user: user.username, msg });
  });

  // Game master sets question/answer
  socket.on('create-question', async ({ question, answer, options }) => {
    const userId = socketUserMap[socket.id];
    if (!userId) return;
    const user = await User.findById(userId);
    const code = socketSessionMap[socket.id];
    const session = await GameSession.findOne({ code });
    if (!user || !user.isGameMaster || !session || session.isActive) return;
    if (!question || !answer) return;
    
    // Validate options: must have at least 2 and answer must be in options
    let validOptions = [];
    if (options && options.length > 0) {
      validOptions = options.map(opt => opt.trim()).filter(opt => opt);
      const answerLower = answer.trim().toLowerCase();
      if (!validOptions.some(opt => opt.toLowerCase() === answerLower)) {
        validOptions.push(answer.trim());
      }
    }
    
    session.questions.push({
      prompt: question.trim(),
      answer: answer.trim().toLowerCase(),
      options: validOptions,
    });
    await session.save();
    await emitQuestionQueue(code);
    socket.emit('game-state', `${session.questions.length} question(s) ready.`);
  });

  // Start game
  socket.on('start-game', async () => {
    const userId = socketUserMap[socket.id];
    if (!userId) return;
    const user = await User.findById(userId);
    const code = socketSessionMap[socket.id];
    const session = await GameSession.findOne({ code }).populate('players');
    if (!user || !user.isGameMaster || !session || session.isActive) return;
    if (session.players.length < 3) {
      socket.emit('session-error', { message: 'At least 3 players are needed to start (including game master).' });
      return;
    }
    if (!session.questions.length) {
      socket.emit('session-error', { message: 'Add at least one question before starting.' });
      return;
    }
    session.isActive = true;
    session.winner = null;
    session.currentQuestionIndex = 0;
    session.startedAt = new Date();
    resetAttemptsForRound(session);
    await session.save();
    await emitQuestionQueue(code);
    await sendCurrentQuestion(code);
  });

  // Player guess
  socket.on('guess', async (guess) => {
    const userId = socketUserMap[socket.id];
    if (!userId) return;
    const user = await User.findById(userId);
    const code = socketSessionMap[socket.id];
    const session = await GameSession.findOne({ code }).populate('players');
    if (!user || !session || !session.isActive || user.isGameMaster) return;
    const attemptsLeft = session.attempts.get(user.username);
    if (!attemptsLeft) return;
    if (session.winner) return;
    const currentQuestion = getCurrentQuestion(session);
    if (!currentQuestion || !guess) return;
    if (guess.trim().toLowerCase() === currentQuestion.answer) {
      await finishRound(session, user, 'correct');
    } else {
      const nextAttempts = Math.max(attemptsLeft - 1, 0);
      session.attempts.set(user.username, nextAttempts);
      await session.save();
      socket.emit('attempts', nextAttempts);
      const eligiblePlayers = getEligiblePlayers(session);
      const allOutOfAttempts = eligiblePlayers.every((player) => (session.attempts.get(player.username) || 0) === 0);
      if (allOutOfAttempts) {
        await finishRound(session, null, 'attempts');
      }
    }
  });

  socket.on('skip-question', async () => {
    const userId = socketUserMap[socket.id];
    if (!userId) return;
    const user = await User.findById(userId);
    const code = socketSessionMap[socket.id];
    const session = await GameSession.findOne({ code }).populate('players');
    if (!user || !session || !session.isActive || user.isGameMaster) return;
    
    const eligiblePlayers = getEligiblePlayers(session);
    if (eligiblePlayers.length === 0) return;
    
    // Add player to skipped list if not already there
    if (!session.skippedBy.includes(user.username)) {
      session.skippedBy.push(user.username);
    }
    
    // Check if all eligible players have either skipped OR have no attempts left
    const allDone = eligiblePlayers.every((player) => {
      const hasSkipped = session.skippedBy.includes(player.username);
      const hasAttempts = (session.attempts.get(player.username) || 0) > 0;
      return hasSkipped || !hasAttempts;
    });
    
    await session.save();
    
    // Broadcast who skipped
    broadcastToSession(code, 'chat', { user: 'System', msg: `${user.username} skipped the question` });
    
    if (allDone) {
      await finishRound(session, null, 'skipped');
    }
  });

  socket.on('disconnect', async () => {
    const userId = socketUserMap[socket.id];
    if (!userId) return;
    const user = await User.findById(userId);
    if (!user) return;
    const code = socketSessionMap[socket.id];
    const session = await GameSession.findOne({ code }).populate('players');
    if (!session) return;
    
    // Remove user from session
    session.players = session.players.filter(p => p.toString() !== user._id.toString());
    session.scores.delete(user.username);
    session.attempts.delete(user.username);
    session.skippedBy = session.skippedBy.filter((name) => name !== user.username);
    
    // If game master leaves, assign new master
    if (user.isGameMaster && session.players.length > 0) {
      const newMaster = await User.findById(session.players[0]);
      if (newMaster) {
        newMaster.isGameMaster = true;
        await newMaster.save();
        broadcastToSession(code, 'game-master');
        broadcastToSession(code, 'game-state', `${newMaster.username} is now the game master!`);
      }
      // Stop game if master leaves while game is active
      if (session.isActive) {
        session.isActive = false;
        session.currentQuestionIndex = -1;
        clearSessionTimer(code);
        broadcastToSession(code, 'game-ended', {
          winner: null,
          answer: null,
        });
        broadcastToSession(code, 'game-state', 'Game stopped. New game master can create questions.');
      }
    }
    
    await session.save();
    await User.deleteOne({ _id: user._id });
    delete socketUserMap[socket.id];
    delete socketSessionMap[socket.id];
    
    // If all players leave, delete session
    if (session.players.length === 0) {
      clearSessionTimer(code);
      await GameSession.deleteOne({ code });
    } else {
      await emitSessionRoster(code);
      await emitQuestionQueue(code);
    }
    
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
