const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  creatorName: {
    type: String,
    trim: true,
  },
  participants: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      joinedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  messages: [
    {
      sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      content: {
        type: String,
        required: true,
      },
      timestamp: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  maxParticipants: {
    type: Number,
    default: 10,
  },
  isPrivate: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastActivity: {
    type: Date,
    default: Date.now,
  },
});

// 채팅방 참여자 수 제한 확인
roomSchema.methods.canJoin = function () {
  return this.participants.length < this.maxParticipants;
};

// 채팅방에 사용자 참여
roomSchema.methods.addParticipant = function (userId) {
  if (this.canJoin()) {
    this.participants.push({ user: userId });
    this.lastActivity = Date.now();
    return true;
  }
  return false;
};

// 채팅방에서 사용자 제거
roomSchema.methods.removeParticipant = function (userId) {
  this.participants = this.participants.filter(
    (participant) => participant.user.toString() !== userId.toString()
  );
  this.lastActivity = Date.now();
};

// MongoDB 모델 생성
const Room = mongoose.model("Room", roomSchema);

module.exports = Room;
