import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  score: { type: Number, default: 0 },
  isGameMaster: { type: Boolean, default: false },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'GameSession' },
  socketId: { type: String },
});

export default mongoose.model('User', userSchema);
