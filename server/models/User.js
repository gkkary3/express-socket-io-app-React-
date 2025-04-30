const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

// 스키마 정의
const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
    },
    guid: {
      type: String,
    },
    // OAuth 관련 필드 (추후 확장을 위해 남겨둠)
    email: {
      type: String,
    },
    provider: {
      type: String,
      required: true,
      enum: ["anonymous", "google", "kakao"],
      default: "anonymous",
    },
    providerId: {
      type: String,
    },
    // 선택적 필드들
    password: {
      type: String,
      minlength: 6,
      select: false, // 기본적으로 조회되지 않도록 설정
    },
    avatar: {
      type: String,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    lastActive: {
      type: Date,
      default: Date.now,
    },
    profileImage: {
      type: String,
      default: "default-profile.png",
    },
  },
  {
    timestamps: true,
    autoIndex: false, // 자동 인덱스 생성 비활성화
  }
);

// 새로운 사용자 생성 시 guid 자동 생성
userSchema.pre("save", function (next) {
  if (!this.guid) {
    this.guid = uuidv4();
  }
  next();
});

module.exports = mongoose.model("User", userSchema);
