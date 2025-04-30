const User = require("../models/User");

// 익명 사용자 생성
exports.createAnonymousUser = async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({
        message: "사용자 이름은 필수입니다.",
      });
    }

    const user = new User({
      username,
      provider: "anonymous",
    });

    await user.save();

    res.status(201).json({
      user: {
        id: user._id,
        username: user.username,
        guid: user.guid,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "익명 사용자 생성 중 오류가 발생했습니다.",
      error: error.message,
    });
  }
};

// 익명 사용자 삭제
exports.deleteAnonymousUser = async (req, res) => {
  try {
    const { guid } = req.params;
    const user = await User.findOneAndDelete({
      guid,
      provider: "anonymous",
    });

    if (!user) {
      return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
    }

    res.json({ message: "사용자가 성공적으로 삭제되었습니다." });
  } catch (error) {
    res.status(500).json({
      message: "사용자 삭제 중 오류가 발생했습니다.",
      error: error.message,
    });
  }
};

// 온라인 사용자 목록 조회
exports.getOnlineUsers = async (req, res) => {
  try {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const users = await User.find({
      lastActive: { $gte: thirtyMinutesAgo },
    }).select("username profileImage lastActive guid");

    res.json(users);
  } catch (error) {
    res.status(500).json({
      message: "사용자 목록 조회 중 오류가 발생했습니다.",
      error: error.message,
    });
  }
};
