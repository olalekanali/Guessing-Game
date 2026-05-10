import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema(
  {
    prompt: { type: String, required: true },
    answer: { type: String, required: true },
  },
  { _id: false }
);

const gameSessionSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  master: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  players: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  questions: { type: [questionSchema], default: [] },
  currentQuestionIndex: { type: Number, default: -1 },
  isActive: { type: Boolean, default: false },
  winner: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  startedAt: { type: Date },
  endedAt: { type: Date },
  attempts: { type: Map, of: Number, default: {} },
  scores: { type: Map, of: Number, default: {} },
  skippedBy: { type: [String], default: [] },
  timer: { type: Number, default: 60 },
});

export default mongoose.model('GameSession', gameSessionSchema);
