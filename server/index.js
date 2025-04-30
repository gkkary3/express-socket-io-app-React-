require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const http = require("http");
const path = require("path");
const initializeSocket = require("./socket/socketManager");
const authRoutes = require("./routes/authRoutes");
const roomRoutes = require("./routes/roomRoutes");

// Express 앱 생성
const app = express();

// 미들웨어 설정
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  })
);
app.use(express.json());

// MongoDB 연결
connectDB();

// 라우트 설정
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);

// 에러 핸들링 미들웨어
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: "서버 오류가 발생했습니다.",
    error: err.message,
  });
});

// 서버 생성
const server = http.createServer(app);

// 소켓 초기화
const io = initializeSocket(server);

// 개발 중에는 React 앱이 별도 서버(3000 포트)에서 실행되므로 정적 파일 제공은 필요 없음
// 프로덕션 환경에서는 React 빌드 파일 제공
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../client/build")));

  app.get("*", (req, res) => {
    res.sendFile(path.resolve(__dirname, "../client/build", "index.html"));
  });
}

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`서버가 ${PORT}번 포트에서 실행중입니다.`);
});
