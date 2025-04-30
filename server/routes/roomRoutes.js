const express = require("express");
const router = express.Router();
const roomController = require("../controllers/roomController");

// 채팅방 생성
router.post("/", roomController.createRoom);

// 채팅방 목록 조회
router.get("/", roomController.getRooms);

// 채팅방 상세 정보 조회
router.get("/:roomId", roomController.getRoom);

// 채팅방 참여
router.post("/:roomId/join", roomController.joinRoom);

// 채팅방 나가기
router.post("/:roomId/leave", roomController.leaveRoom);

// 채팅방 삭제
router.delete("/:roomId", roomController.deleteRoom);

module.exports = router;
