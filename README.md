# 🎮 Guessing Game

A fun, real-time guessing game where you and your friends can compete to answer questions!

## 🎯 Features

- ✅ **Live Chat Interface** - Modern, intuitive UI with chat-like design
- ✅ **Game Master Control** - One player creates questions and starts the game
- ✅ **Real-time Multiplayer** - Socket.io powered live gameplay
- ✅ **Score Tracking** - Keep track of all players' scores
- ✅ **Countdown Timer** - 60-second (default) countdown per question
- ✅ **3 Attempts** - Each player gets 3 attempts to guess the answer
- ✅ **Skip Option** - Players can skip questions
- ✅ **Dynamic Game Master** - Master role passes to next player when game ends
- ✅ **Player Management** - Prevent players from joining mid-game
- ✅ **Auto Cleanup** - Sessions auto-delete when all players leave

## 🚀 Quick Start

### Prerequisites
- Node.js (v14+)
- MongoDB (local or Atlas)
- npm

### Installation

1. **Clone/Setup the project:**
```bash
cd Guessing-Game
npm install
```

2. **Configure environment:**
```bash
cp .env.example .env
```

3. **Edit `.env` file** with your MongoDB URI:
```env
MONGO_URI=mongodb://localhost:27017/guessing-game
PORT=3000
```

4. **Start the server:**
```bash
npm run dev
```

5. **Open in browser:**
```
http://localhost:3000
```

## 🎮 How to Play

### For Game Master:
1. Enter your name and click "Create Game"
2. Share the game code or link with friends
3. Wait for at least 2 other players (3 total including you)
4. Add questions with answers
5. Click "▶ Start Game" when ready

### For Players:
1. Enter your name
2. Enter the game code and click "Join Game"
3. Wait for the game to start
4. When asked, type your answer guess
5. You have 3 attempts per question
6. Click "Skip Question" if you want to pass

## 📋 Game Rules

- **Minimum Players:** 3 (including game master)
- **Attempts:** 3 per player per question
- **Time Limit:** 60 seconds per question
- **Points:** 10 points for correct answer
- **Game Ends:** When all questions are answered or timer expires

### Winning Conditions:
- ✅ **Player Wins:** First player to answer correctly (10 points + answer revealed)
- ❌ **Timeout:** Time expires, no winner, answer revealed
- ⏭️ **Skip:** All players skip, answer revealed

## 🏗️ Project Structure

```
Guessing-Game/
├── index.js              # Server entry point & Socket.io logic
├── package.json          # Dependencies
├── .env.example         # Environment template
├── README.md            # This file
├── public/
│   ├── client.js        # Client-side socket & UI logic
│   └── style.css        # Modern responsive styling
├── views/
│   └── index.ejs        # HTML template
└── src/
    ├── config/
    │   └── db.config.js  # MongoDB connection
    └── models/
        ├── GameSession.js # Session schema
        ├── User.js        # User schema
        └── Score.js       # Score tracking (optional)
```

## 🔧 Socket Events

### Client → Server
- `create-session` - Create new game
- `join-session` - Join existing game
- `create-question` - Add question (game master only)
- `start-game` - Begin the game (game master only)
- `guess` - Submit answer
- `skip-question` - Skip current question
- `chat` - Send chat message

### Server → Client
- `session-created` - Game created
- `session-joined` - Joined successfully
- `game-master` - Promoted to game master
- `game-started` - Game began
- `game-ended` - Game finished
- `question` - New question displayed
- `players` - Player list updated
- `scoreboard` - Scores updated
- `chat` - Chat message received
- `timer` - Time remaining

## 🎨 UI Features

- **Responsive Design** - Works on mobile and desktop
- **Real-time Updates** - Live player/score updates
- **Color-coded States** - Visual feedback for game states
- **Countdown Timer** - Clear time display during gameplay
- **Emoji Indicators** - Visual indicators for status (👑, 🎮, etc.)

## 🐛 Known Issues & Fixes

### Fixed Issues:
✅ Minimum player count now correctly set to 3  
✅ Attempts display bug fixed (no more duplicate attempts text)  
✅ Players can't join mid-game  
✅ Game master auto-changes when leaving  
✅ Questions clear for next round  
✅ Modern responsive UI  
✅ Timer countdown display  

## 🚀 Future Enhancements

- [ ] Difficulty levels
- [ ] Category selection
- [ ] Custom timer duration
- [ ] User authentication
- [ ] Persistent leaderboards
- [ ] Game statistics
- [ ] Hint system
- [ ] Multiple-choice questions

## 📝 License

ISC - Feel free to modify and use!

## 👨‍💻 Development

Run in development mode:
```bash
npm run dev
```

Uses Nodemon for auto-restart on file changes.

## 🐛 Troubleshooting

**"Game not found"** → Check game code spelling  
**"Cannot start - need 3 players"** → Wait for more players to join  
**"Name already taken"** → Choose a different name  
**"Cannot join - game in progress"** → Wait for next round

## 📞 Support

For issues, check:
1. MongoDB is running and connected
2. `.env` file has correct `MONGO_URI`
3. Port 3000 is not in use
4. Both players use same game code
