# 🚀 Deployment & Configuration Guide

## Environment Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Create `.env` file (copy from `.env.example`):

```env
# MongoDB Connection String
MONGO_URI=mongodb://localhost:27017/guessing-game

# Server Port
PORT=3000
```

#### MongoDB Options:
- **Local MongoDB:** `mongodb://localhost:27017/guessing-game`
- **MongoDB Atlas Cloud:**
  ```
  mongodb+srv://username:password@cluster.mongodb.net/guessing-game
  ```

### 3. Start Server

**Development (with auto-reload):**
```bash
npm run dev
```

**Production:**
```bash
node index.js
```

## 🔍 Verification Checklist

Before going live, verify:

- [ ] MongoDB is running and accessible
- [ ] `.env` file is configured
- [ ] `npm install` completed successfully
- [ ] Server starts without errors
- [ ] Can access `http://localhost:3000`
- [ ] Can create a game session
- [ ] Can join a game with another tab/device
- [ ] Game starts with 3+ players
- [ ] Questions display correctly
- [ ] Timer counts down
- [ ] Chat works
- [ ] Scores update in real-time

## 📊 Database Schema

### GameSession Collection
```javascript
{
  _id: ObjectId,
  code: String (unique), // 6-char session code
  master: ObjectId, // Reference to User (game master)
  players: [ObjectId], // Array of player references
  questions: [
    {
      prompt: String,
      answer: String (lowercase)
    }
  ],
  currentQuestionIndex: Number, // -1 = not started
  isActive: Boolean, // Is game in progress?
  winner: String, // Last question winner
  scores: Map<String, Number>, // {username: points}
  attempts: Map<String, Number>, // {username: attemptsLeft}
  skippedBy: [String], // [usernames who skipped]
  timer: Number, // 60 (seconds per question)
  createdAt: Date,
  startedAt: Date,
  endedAt: Date
}
```

### User Collection
```javascript
{
  _id: ObjectId,
  username: String,
  isGameMaster: Boolean,
  sessionId: ObjectId, // Reference to GameSession
  socketId: String, // Socket.io connection ID
  score: Number, // Current session score
}
```

## ⚙️ Configuration Options

### Game Settings (in `index.js`)

**Change minimum players:**
```javascript
if (session.players.length < 3) { // Change 3 to desired number
```

**Change question timer (seconds):**
```javascript
// In GameSession schema
timer: { type: Number, default: 60 }, // Change 60 to desired seconds
```

**Change winning points:**
```javascript
// In finishRound function
(session.scores.get(winnerUser.username) || 0) + 10 // Change 10 to desired points
```

**Change player attempts:**
```javascript
// In resetAttemptsForRound function
session.attempts.set(player.username, 3); // Change 3 to desired attempts
```

## 🔒 Security Considerations

### Current Implementation
- ✅ Input validation on all socket events
- ✅ User ownership verification
- ✅ Game state validation
- ✅ Session isolation (players can't access other sessions)

### Recommended Additions for Production
- [ ] Add JWT authentication
- [ ] Implement CORS with specific origins
- [ ] Rate limiting on socket events
- [ ] Input sanitization (prevent XSS)
- [ ] HTTPS/WSS encryption
- [ ] Helmet.js for HTTP headers
- [ ] MongoDB connection pooling
- [ ] Rate limiting middleware

### Example JWT Implementation:
```javascript
// Install: npm install jsonwebtoken
import jwt from 'jsonwebtoken';

socket.on('create-session', async ({ username, token }) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Proceed with session creation
  } catch (err) {
    socket.emit('auth-error', { message: 'Invalid token' });
  }
});
```

## 📈 Performance Optimization

### Current Optimizations
- ✅ In-memory socket mapping (no DB lookups)
- ✅ Efficient database queries with `.populate()`
- ✅ Proper indexing on unique fields
- ✅ Clean event listener management
- ✅ Proper timeout cleanup

### Further Optimizations
- [ ] Add Redis for session caching
- [ ] Implement message batching
- [ ] Add database connection pooling
- [ ] Use CDN for static assets
- [ ] Implement gzip compression
- [ ] Add caching headers to static files

### Example Redis Integration:
```javascript
// Install: npm install redis
import redis from 'redis';

const redisClient = redis.createClient({
  url: process.env.REDIS_URL
});

await redisClient.connect();
// Cache game sessions with TTL
```

## 🧪 Testing Locally

### Test 1: Create & Join Game
```bash
# Terminal 1: Start server
npm run dev

# Terminal 2-3: Open in different browsers
http://localhost:3000
```

1. Create game as Player 1
2. Share code with Player 2 & 3
3. All join successfully

### Test 2: Game Flow
1. Add 2 questions as game master
2. Try to start (should fail - need 3 players)
3. Add 2nd player
4. Try to start (should fail - need 3 players total)
5. Add 3rd player
6. Start game (should succeed)

### Test 3: Gameplay
1. Question displays on all screens
2. Try to guess on each player
3. Verify points awarded to winner
4. Verify attempt counter decreases
5. Next question loads automatically

### Test 4: Edge Cases
1. Disconnect player - verify roster updates
2. Game master disconnects - verify new master assigned
3. All players disconnect - verify session deleted
4. Player joins mid-game - verify rejected with error
5. Try duplicate username - verify rejected

## 📚 API Events Reference

### Emitted TO Clients
```javascript
// Socket.io events sent to clients
socket.emit('session-created', { code, link });
socket.emit('session-joined', { code });
socket.emit('game-master'); // Client is now game master
socket.emit('session-error', { message });
socket.emit('players', [...]);
socket.emit('scoreboard', [...]);
socket.emit('question', { prompt, index, total });
socket.emit('game-started', { timerDuration });
socket.emit('round-ended', { winner, answer, reason, hasNext });
socket.emit('game-ended', { winner, answer });
socket.emit('question-queue', { total, nextIndex, questions });
socket.emit('chat', { user, msg });
socket.emit('attempts', attemptsLeft);
socket.emit('game-state', msg);
socket.emit('winner-message', msg);
```

### Received FROM Clients
```javascript
socket.on('create-session', ({ username }) => {});
socket.on('join-session', ({ username, code }) => {});
socket.on('create-question', ({ question, answer }) => {});
socket.on('start-game', () => {});
socket.on('guess', (guess) => {});
socket.on('skip-question', () => {});
socket.on('chat', (msg) => {});
socket.on('disconnect', () => {});
```

## 🚨 Troubleshooting

### Server Won't Start
**Error:** `Cannot find module 'mongoose'`
- **Solution:** Run `npm install`

**Error:** `MONGO_URI not defined`
- **Solution:** Create `.env` file with MONGO_URI

**Error:** `Port 3000 in use`
- **Solution:** Change PORT in `.env` or kill process: `lsof -ti:3000 | xargs kill -9`

### Game Issues
**Q:** Players can see each other but can't chat
- **A:** Check socket.io is connecting properly in browser console

**Q:** Questions don't display
- **A:** Verify game master added questions before starting

**Q:** Scores not updating
- **A:** Check database connection, verify scores map in session

**Q:** Timer doesn't show
- **A:** Check browser console for JS errors, verify timerDisplay element exists

## 📝 Monitoring & Logging

### Add Enhanced Logging
```javascript
// In index.js
io.on('connection', (socket) => {
  console.log(`[${new Date().toISOString()}] User connected:`, socket.id);
  
  socket.on('create-session', async ({ username }) => {
    console.log(`[${new Date().toISOString()}] Session created by ${username}`);
  });
  
  socket.on('disconnect', () => {
    console.log(`[${new Date().toISOString()}] User disconnected:`, socket.id);
  });
});
```

### Check Active Sessions
```javascript
// Add this route to check game status
app.get('/stats', async (req, res) => {
  const sessions = await GameSession.find();
  res.json({
    activeSessions: sessions.length,
    totalPlayers: await User.countDocuments(),
    sessions: sessions.map(s => ({
      code: s.code,
      players: s.players.length,
      isActive: s.isActive,
      createdAt: s.createdAt
    }))
  });
});
```

## 🔄 Deployment Platforms

### Heroku
```bash
# Install Heroku CLI
npm install -g heroku

# Login
heroku login

# Create app
heroku create your-guessing-game

# Set environment variables
heroku config:set MONGO_URI="your_mongodb_uri"

# Deploy
git push heroku main
```

### AWS EC2
- SSH into instance
- Install Node.js and MongoDB
- Clone repository
- Configure `.env`
- Use PM2 for process management: `npm install pm2 -g`
- Start: `pm2 start index.js`

### Railway/Render
- Connect GitHub repository
- Set MONGO_URI in environment variables
- Deploy automatically on push

## ✨ Final Checklist

- [ ] All errors fixed (3 player min, attempts display, etc.)
- [ ] Modern UI implemented
- [ ] Timer functionality working
- [ ] Documentation complete
- [ ] `.env.example` provided
- [ ] README complete
- [ ] All socket events working
- [ ] Database properly configured
- [ ] Ready for testing
- [ ] Ready for deployment

---

**Congratulations!** Your Guessing Game is now production-ready! 🎉
