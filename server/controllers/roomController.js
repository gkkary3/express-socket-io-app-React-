const Room = require("../models/Room");
const User = require("../models/User");

// 채팅방 생성
exports.createRoom = async (req, res) => {
  try {
    const { name, maxParticipants, isPrivate } = req.body;
    const creator = req.user._id; // 인증 미들웨어에서 설정된 사용자 ID

    const room = new Room({
      name,
      creator,
      maxParticipants,
      isPrivate,
    });

    // 생성자를 첫 번째 참여자로 추가
    room.addParticipant(creator);
    await room.save();

    res.status(201).json({
      message: "채팅방이 생성되었습니다.",
      room,
    });
  } catch (error) {
    res.status(500).json({
      message: "채팅방 생성 중 오류가 발생했습니다.",
      error: error.message,
    });
  }
};

// 채팅방 목록 조회
exports.getRooms = async (req, res) => {
  try {
    const rooms = await Room.find({ isPrivate: false })
      .populate("creator", "username profileImage")
      .populate("participants.user", "username profileImage")
      .sort({ lastActivity: -1 });

    res.json(rooms);
  } catch (error) {
    res.status(500).json({
      message: "채팅방 목록 조회 중 오류가 발생했습니다.",
      error: error.message,
    });
  }
};

// 채팅방 상세 정보 조회
exports.getRoom = async (req, res) => {
  try {
    const roomId = req.params.roomId;
    const room = await Room.findById(roomId)
      .populate("creator", "username")
      .populate("participants", "username");

    if (!room) {
      return res.status(404).json({ message: "채팅방을 찾을 수 없습니다." });
    }

    res.json({ room });
  } catch (error) {
    console.error("채팅방 상세 정보 조회 오류:", error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
};

// 채팅방 참여
exports.joinRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user._id;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: "채팅방을 찾을 수 없습니다." });
    }

    if (!room.canJoin()) {
      return res.status(400).json({ message: "채팅방이 가득 찼습니다." });
    }

    if (room.addParticipant(userId)) {
      await room.save();
      res.json({ message: "채팅방에 참여했습니다.", room });
    } else {
      res.status(400).json({ message: "채팅방 참여에 실패했습니다." });
    }
  } catch (error) {
    res.status(500).json({
      message: "채팅방 참여 중 오류가 발생했습니다.",
      error: error.message,
    });
  }
};

// 채팅방 나가기
exports.leaveRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user._id;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: "채팅방을 찾을 수 없습니다." });
    }

    room.removeParticipant(userId);
    await room.save();

    res.json({ message: "채팅방에서 나갔습니다." });
  } catch (error) {
    res.status(500).json({
      message: "채팅방 나가기 중 오류가 발생했습니다.",
      error: error.message,
    });
  }
};

// 채팅방 삭제
exports.deleteRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId } = req.body;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: "채팅방을 찾을 수 없습니다." });
    }

    // 방 생성자만 삭제할 수 있도록 체크
    if (room.creator.toString() !== userId) {
      return res
        .status(403)
        .json({ message: "채팅방을 삭제할 권한이 없습니다." });
    }

    await Room.findByIdAndDelete(roomId);
    res.json({ message: "채팅방이 삭제되었습니다." });
  } catch (error) {
    console.error("채팅방 삭제 중 오류:", error);
    res.status(500).json({ message: "채팅방 삭제 중 오류가 발생했습니다." });
  }
};
