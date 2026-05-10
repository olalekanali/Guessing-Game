import mongoose from 'mongoose';

const scoreSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  points: { type: Number, default: 0 },
});

export default mongoose.model('Score', scoreSchema);
