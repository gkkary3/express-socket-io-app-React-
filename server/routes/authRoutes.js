const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

// 익명 사용자 생성
router.post("/anonymous", authController.createAnonymousUser);

// 익명 사용자 삭제 (guid로 삭제)
router.delete("/anonymous/:guid", authController.deleteAnonymousUser);

// 온라인 사용자 목록 조회
router.get("/online", authController.getOnlineUsers);

module.exports = router;
