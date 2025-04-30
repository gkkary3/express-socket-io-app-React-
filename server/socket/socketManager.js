const { Server } = require("socket.io");
const {
  addUser,
  getUsersInRoom,
  getUser,
  getUserBySocketId,
  removeUser,
  removeUserFromRoom,
  getAllUsers,
  addUserWithoutRoom,
} = require("../utils/users");
const { generateMessage } = require("../utils/messages");
const Room = require("../models/Room");
const User = require("../models/User");

// 방 목록 업데이트 및 전송 함수
const updateRoomsList = async (io) => {
  try {
    // MongoDB에서 공개 채팅방 목록 가져오기
    const rooms = await Room.find({ isPrivate: false })
      .populate("creator", "username profileImage")
      .populate({
        path: "participants.user",
        select: "username profileImage",
      })
      .sort({ lastActivity: -1 });

    // MongoDB에서 가져온 참여자 정보를 포함하여 클라이언트에 전송할 방 목록 생성
    const roomsWithDetails = rooms.map((room) => {
      // MongoDB 참여자 정보 처리
      const participants = room.participants
        .filter((p) => p.user) // null이 아닌 참여자만 포함
        .map((p) => ({
          username: p.user.username,
          profileImage: p.user.profileImage || "default-profile.png",
        }));

      // 메모리상의 사용자 (방 ID 기준으로 조회)
      const memoryUsers = getUsersInRoom(room._id.toString());
      const users = memoryUsers.map((u) => ({
        username: u.username,
        id: u.guid,
      }));

      // 참여자 수 계산 (메모리 상 사용자 수를 우선 사용, 없으면 MongoDB 참여자 수)
      const userCount =
        memoryUsers.length > 0 ? memoryUsers.length : participants.length;

      return {
        _id: room._id,
        name: room.name,
        creator: room.creator,
        isPrivate: room.isPrivate,
        lastActivity: room.lastActivity,
        participants: participants,
        userCount: userCount,
        users:
          users.length > 0
            ? users
            : participants.map((p) => ({ username: p.username, id: "" })),
      };
    });

    // 방 목록 업데이트
    io.emit("roomsList", roomsWithDetails);
  } catch (error) {
    console.error("방 목록 업데이트 중 오류:", error);
  }
};

// 온라인 사용자 목록 업데이트 및 전송 함수
const updateOnlineUsers = (io) => {
  const users = getAllUsers();
  io.emit("onlineUsers", users);
};

// disconnect 타이머 관리 객체
const disconnectTimers = {};

const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingTimeout: 60000, // 60초로 늘림
    pingInterval: 25000, // 25초로 설정
  });

  io.on("connection", (socket) => {
    // 새 연결이 오면 disconnect 타이머 취소
    if (disconnectTimers[socket.id]) {
      clearTimeout(disconnectTimers[socket.id]);
      delete disconnectTimers[socket.id];
      console.log(`재연결 감지, 사용자 제거 타이머 취소: ${socket.id}`);
    }

    console.log("새로운 클라이언트 연결:", socket.id);

    // 초기 상태 전송
    updateRoomsList(io);
    updateOnlineUsers(io);

    socket.on("error", (error) => {
      console.error("소켓 에러:", error);
      socket.emit("error", {
        message: error.message || "알 수 없는 오류가 발생했습니다.",
      });
    });

    // 로그인 처리
    socket.on("login", async ({ username, guid }) => {
      console.log(`로그인 요청 수신: ${username}, GUID: ${guid}`);
      try {
        // 사용자 이름 중복을 허용하도록 항상 새로운 사용자 생성
        const user = await User.create({
          username,
          guid: guid || null,
          lastActive: new Date(),
        });

        console.log(`새 사용자 생성: ${user._id}`);

        // 메모리에 사용자 추가
        const { error } = addUserWithoutRoom({
          id: socket.id,
          username,
          guid: user._id.toString(),
        });

        if (error) {
          console.error(`사용자 추가 중 오류: ${error}`);
          socket.emit("error", { message: error });
          return;
        }

        // 로그인 성공 응답
        console.log(`로그인 성공 응답 전송: ${username}, ID: ${user._id}`);
        socket.emit("loginSuccess", { user });

        // 온라인 사용자 목록 업데이트
        updateOnlineUsers(io);

        console.log(
          `사용자 로그인 성공: ${username} (${socket.id}), ID: ${user._id}`
        );
      } catch (error) {
        console.error("로그인 처리 중 오류:", error);
        socket.emit("error", {
          message: "로그인 처리 중 오류가 발생했습니다.",
        });
      }
    });

    // 방 생성 처리 (새로운 이벤트 추가)
    socket.on("createRoom", async ({ username, roomName }, callback) => {
      try {
        if (!username || !roomName) {
          socket.emit("error", {
            message: "사용자 이름 또는 방 이름이 필요합니다.",
          });
          if (callback) callback("사용자 이름 또는 방 이름이 필요합니다.");
          return;
        }

        // 기존 로그인 사용자 정보 가져오기
        const socketUser = getUserBySocketId(socket.id);

        // 기존 socketUser가 없으면 새로 생성
        let userId;
        if (socketUser && socketUser.guid) {
          userId = socketUser.guid;
          console.log(`기존 사용자로 방 생성: ${username}, ID: ${userId}`);
        } else {
          // 기존 사용자가 없는 경우만 새로 생성
          const newUser = await User.create({
            username,
            lastActive: new Date(),
          });
          userId = newUser._id;
          console.log(`새 사용자로 방 생성: ${username}, ID: ${userId}`);
        }

        // 방 이름 중복 체크를 하지 않고 항상 새 방 생성
        const newRoom = await Room.create({
          name: roomName,
          creator: userId,
          creatorName: username, // 방 생성자 이름 저장
          participants: [{ user: userId }],
          isPrivate: false,
        });
        console.log(
          `방 생성 성공: ${newRoom._id}, 방 이름: ${roomName}, 생성자: ${username}`
        );

        // 방 목록 업데이트
        updateRoomsList(io);
        if (callback) callback(null, { _id: newRoom._id, name: newRoom.name });
      } catch (error) {
        console.error("방 생성 중 오류:", error);
        socket.emit("error", { message: "방 생성 중 오류가 발생했습니다." });
        if (callback) callback("방 생성 중 오류가 발생했습니다.");
      }
    });

    // 방 입장 처리 (roomId로만 입장하도록 수정)
    socket.on("join", async ({ username, roomId }) => {
      try {
        console.log(`사용자 방 입장 시도: ${username}, 방ID: ${roomId}`);

        if (!username || !roomId) {
          console.error("사용자 이름 또는 방 ID가 없음");
          socket.emit("error", {
            message: "사용자 이름 또는 방 ID가 필요합니다.",
          });
          return;
        }

        // 소켓에 사용자 정보가 없는 경우 다시 처리
        let user = getUserBySocketId(socket.id);
        if (!user) {
          console.log("소켓에 사용자 정보가 없음, 다시 추가 시도");

          // MongoDB에서 사용자 조회
          let mongoUser = await User.findOne({ username: username });

          if (!mongoUser) {
            // 사용자가 없으면 새로 생성
            try {
              mongoUser = await User.create({
                username,
                lastActive: new Date(),
              });
              console.log(`새 사용자 생성: ${username}`);
            } catch (err) {
              console.error("새 사용자 생성 중 오류:", err);
              socket.emit("error", {
                message: "사용자 정보 생성 중 오류가 발생했습니다.",
              });
              return;
            }
          }

          // 메모리에 사용자 추가
          const addResult = addUserWithoutRoom({
            id: socket.id,
            username: username,
            guid: mongoUser._id.toString(),
          });

          if (addResult.error) {
            console.error("메모리에 사용자 추가 중 오류:", addResult.error);
            socket.emit("error", { message: addResult.error });
            return;
          }

          user = addResult.user;
          console.log("사용자 정보 추가됨:", user);
        }

        // roomId로 방 찾기 (ObjectId)
        let roomDoc = await Room.findById(roomId);
        if (!roomDoc) {
          console.error(`방을 찾을 수 없음: ${roomId}`);
          socket.emit("error", { message: "존재하지 않는 방입니다." });
          return;
        }

        // MongoDB 사용자 정보 가져오기
        const mongoUser = await User.findOne({ username: username });
        if (!mongoUser) {
          console.error("MongoDB에서 사용자 정보를 찾을 수 없음:", username);
          socket.emit("error", { message: "사용자 정보를 찾을 수 없습니다." });
          return;
        }

        // 방에 참여자 추가
        roomDoc.participants.push({ user: mongoUser._id });
        roomDoc.lastActivity = new Date();
        await roomDoc.save();
        console.log(`사용자를 방에 추가: ${username}, 방: ${roomDoc.name}`);

        // 메모리에 사용자 추가 (방 ID 사용)
        try {
          const addResult = addUser({
            id: socket.id,
            username: user.username,
            room: roomDoc.name, // 방 이름 사용
            roomId: roomDoc._id.toString(), // 방 ID는 별도 필드로 저장
            guid: user.guid,
          });

          if (addResult.error) {
            console.error("메모리에 사용자 추가 중 오류:", addResult.error);
            socket.emit("error", { message: addResult.error });
            return;
          }

          // 메모리 사용자의 inRoom 상태를 명시적으로 true로 설정
          const memoryUser = getUserBySocketId(socket.id);
          if (memoryUser) {
            memoryUser.inRoom = true;
            console.log(
              `사용자 ${memoryUser.username}의 inRoom 상태를 true로 설정`
            );
          }

          // 온라인 사용자 목록 업데이트
          updateOnlineUsers(io);
        } catch (err) {
          console.error("메모리에 사용자 추가 중 오류:", err);
          socket.emit("error", {
            message: "사용자 정보 처리 중 오류가 발생했습니다.",
          });
          return;
        }

        // 소켓을 방에 조인 (방 ID 사용)
        socket.join(roomDoc._id.toString());
        console.log(
          `소켓을 방에 조인: ${socket.id}, 방: ${roomDoc.name}, ID: ${roomDoc._id}`
        );

        // 방에 있는 모든 사용자에게 새 사용자 입장 알림 메시지 전송
        io.to(roomDoc._id.toString()).emit("message", {
          type: "notice",
          text: `${username}님이 채팅방에 참여하셨습니다.`,
          timestamp: new Date(),
        });

        // 방 입장 알림
        io.to(roomDoc._id.toString()).emit("userJoined", {
          user: {
            id: socket.id,
            username: user.username,
          },
        });

        // 방 참여자 목록 업데이트 및 roomData 전송
        const usersInRoom = getUsersInRoom(roomDoc._id.toString());

        // 방 참여자 목록 (실시간 참여자)
        const usersData = usersInRoom.map((user) => ({
          username: user.username,
          id: user.guid,
        }));

        // 방 정보에 creator 정보 포함
        io.to(roomDoc._id.toString()).emit("roomData", {
          room: roomDoc.name,
          roomId: roomDoc._id.toString(),
          users: usersData,
          _id: roomDoc._id.toString(),
          creator: {
            _id: roomDoc.creator.toString(),
            username: roomDoc.creatorName || user.username,
          },
        });

        // 방 입장 성공 응답
        socket.emit("joinSuccess", {
          room: roomDoc.name,
          roomId: roomDoc._id.toString(),
          users: usersData,
          _id: roomDoc._id.toString(),
          creator: {
            _id: roomDoc.creator.toString(),
            username: roomDoc.creatorName || mongoUser.username,
          },
        });

        // 방 목록 업데이트
        updateRoomsList(io);
      } catch (error) {
        console.error("방 입장 처리 중 오류:", error);
        socket.emit("error", {
          message:
            "방 입장 처리 중 오류가 발생했습니다: " +
            (error.message || "알 수 없는 오류"),
        });
      }
    });

    // 메시지 전송 처리
    socket.on("sendMessage", async (message, callback) => {
      try {
        console.log("메시지 전송 요청:", message);
        const user = getUserBySocketId(socket.id);
        if (!user) {
          socket.emit("error", { message: "로그인이 필요합니다." });
          if (callback) callback("로그인이 필요합니다.");
          return;
        }

        if (!user.room) {
          socket.emit("error", {
            message: "방에 입장해야 메시지를 보낼 수 있습니다.",
          });
          if (callback) callback("방에 입장해야 메시지를 보낼 수 있습니다.");
          return;
        }

        console.log(
          `메시지 전송: ${user.username}, 방: ${user.room}, 메시지: ${message}`
        );

        try {
          // MongoDB에서 방 정보 가져오기
          const room = await Room.findOne({ name: user.room });

          if (!room) {
            console.error(`방을 찾을 수 없음: ${user.room}`);
            socket.emit("error", { message: "존재하지 않는 방입니다." });
            if (callback) callback("존재하지 않는 방입니다.");
            return;
          }

          // MongoDB 사용자 정보 가져오기
          const mongoUser = await User.findById(user.guid);
          if (!mongoUser) {
            console.error(`사용자를 찾을 수 없음: ${user.guid}`);
            socket.emit("error", {
              message: "사용자 정보를 찾을 수 없습니다.",
            });
            if (callback) callback("사용자 정보를 찾을 수 없습니다.");
            return;
          }

          // 메시지 저장
          if (!room.messages) {
            room.messages = [];
          }

          room.messages.push({
            sender: user.guid,
            content: message,
            timestamp: new Date(),
          });

          // 방의 마지막 활동 시간 업데이트
          room.lastActivity = new Date();
          await room.save();

          const timestamp = new Date();

          // 메시지 브로드캐스트 (타입을 일반 메시지로 설정)
          // room ID를 사용하여 이벤트 전송 (room 이름으로는 전송이 안됨)
          io.to(user.roomId || user.room).emit("message", {
            user: {
              id: socket.id,
              username: user.username,
            },
            username: user.username,
            text: message,
            timestamp: timestamp,
            createdAt: timestamp,
          });

          console.log(
            `메시지 전송 성공: ${user.username}, 방: ${user.room}, 방ID: ${user.roomId}`
          );

          // 콜백 호출
          if (callback) callback();
        } catch (err) {
          console.error("메시지 저장 중 오류:", err);
          socket.emit("error", {
            message: "메시지 저장 중 오류가 발생했습니다.",
          });
          if (callback) callback("메시지 저장 중 오류가 발생했습니다.");
        }
      } catch (error) {
        console.error("메시지 전송 처리 중 오류:", error);
        socket.emit("error", {
          message: "메시지 전송 처리 중 오류가 발생했습니다.",
        });
        if (callback) callback("메시지 전송 중 오류가 발생했습니다.");
      }
    });

    // 방 나가기 처리
    socket.on("leave", async (data) => {
      try {
        console.log("방 나가기 시도:", data);

        // 사용자 정보 가져오기
        const user = getUserBySocketId(socket.id);
        if (!user) {
          socket.emit("error", { message: "로그인이 필요합니다." });
          return;
        }

        // 사용자가 참여 중인 방 정보가 없으면 에러 응답
        if (!user.room) {
          socket.emit("error", { message: "참여 중인 방이 없습니다." });
          return;
        }

        // 방 ID 또는 이름 구하기
        const roomId = data?.roomId || user.roomId || user.room;
        console.log(`방 나가기: ${user.username}, 방: ${roomId}`);

        // 방 객체를 상위 스코프에 선언
        let room = null;

        try {
          // MongoDB에서 방 정보 가져오기 (roomId가 name이 아닌 id일 경우에 대비)
          try {
            // 먼저 ID로 시도
            room = await Room.findById(roomId);
          } catch (err) {
            // ID로 찾지 못하면 이름으로 시도
            room = await Room.findOne({ name: roomId });
          }

          if (room) {
            // MongoDB 사용자 정보 가져오기
            const mongoUser = await User.findOne({ username: user.username });
            if (mongoUser) {
              console.log("현재 방 참여자 수:", room.participants.length);

              // 중복 참여자 제거 (동일한 사용자가 여러 번 참여 기록이 있을 수 있음)
              const uniqueParticipants = [];
              const participantUserIds = new Set();

              room.participants.forEach((participant) => {
                if (
                  participant.user &&
                  !participantUserIds.has(participant.user.toString())
                ) {
                  participantUserIds.add(participant.user.toString());
                  uniqueParticipants.push(participant);
                }
              });

              // 중복이 제거된 실제 참여자 배열로 업데이트
              room.participants = uniqueParticipants;
              console.log("중복 제거 후 참여자 수:", room.participants.length);

              // 방 참여자 목록에서 사용자 제거
              room.participants = room.participants.filter(
                (participant) =>
                  participant.user &&
                  participant.user.toString() !== mongoUser._id.toString()
              );

              // 메모리에 남아있는 사용자 확인
              const memoryUsersInRoom = getUsersInRoom(roomId).filter(
                (u) => u.id !== socket.id
              );
              console.log(
                "나를 제외한 메모리 참여자 수:",
                memoryUsersInRoom.length
              );

              // 참여자가 제거된 후 상태 확인 (마지막 사용자가 나가면 방 삭제)
              // 메모리 사용자가 없거나 MongoDB 참여자가 없으면 방 삭제
              if (
                room.participants.length === 0 ||
                memoryUsersInRoom.length === 0
              ) {
                console.log(`마지막 참여자가 나가서 방 삭제: ${roomId}`);

                // 방에 있는 모든 사용자에게 방 삭제 알림
                io.to(roomId).emit("roomDeleted", { roomId: room._id });

                // MongoDB에서 방 삭제
                await Room.findByIdAndDelete(room._id);
              } else {
                console.log(
                  `참여자가 아직 ${room.participants.length}명 남아있어 방 유지: ${roomId}`
                );
                await room.save();
              }

              console.log(`방 참여자 목록에서 사용자 제거: ${user.username}`);
            }
          }
        } catch (err) {
          console.error("방 정보 업데이트 중 오류:", err);
          // 오류가 발생해도 사용자는 나가게 함
        }

        // 메모리에서 사용자 방 정보만 제거
        if (user) removeUserFromRoom(user.guid);
        console.log(`메모리에서 사용자 방 정보만 제거: ${socket.id}`);

        // 소켓을 방에서 나가기
        socket.leave(user.roomId || roomId);
        console.log(
          `소켓을 방에서 나가기: ${socket.id}, 방: ${user.roomId || roomId}`
        );

        // 방 나가기 알림
        io.to(user.roomId || roomId).emit("userLeft", {
          user: {
            id: user.guid, // guid 기준
            username: user.username,
          },
        });

        // leave 후 최신 참여자 목록 계산 및 roomData emit
        const actualRoomId = user.roomId || roomId;
        const memoryUsers = getUsersInRoom(actualRoomId); // inRoom이 true인 사용자만
        const usersData = memoryUsers.map((u) => ({
          username: u.username,
          id: u.guid,
        }));

        // 방 이름 찾기 시도
        const roomName = room ? room.name : user.room || roomId;

        io.to(user.roomId || roomId).emit("roomData", {
          room: roomName,
          roomId: user.roomId || roomId,
          users: usersData,
          creator: room
            ? {
                _id: room.creator,
                username: room.creatorName,
              }
            : null,
        });

        // 방 목록 업데이트
        updateRoomsList(io);

        // 온라인 사용자 목록 업데이트
        updateOnlineUsers(io);

        // 나가기 성공 응답
        socket.emit("leaveSuccess");
        console.log(`방 나가기 성공: ${user.username}`);
      } catch (error) {
        console.error("방 나가기 처리 중 오류:", error);
        socket.emit("error", {
          message:
            "방 나가기 처리 중 오류가 발생했습니다: " +
            (error.message || "알 수 없는 오류"),
        });
      }
    });

    // 채팅방 삭제 처리
    socket.on("deleteRoom", async ({ roomId, userId, username }, callback) => {
      try {
        console.log("방 삭제 요청 수신:", { roomId, userId, username });

        if (!roomId) {
          console.error("방 ID가 없어서 삭제 불가:");
          if (callback) callback("삭제할 방 ID가 없습니다.");
          socket.emit("error", { message: "삭제할 방 ID가 없습니다." });
          return;
        }

        console.log(`방 ID로 방 찾기 시도: ${roomId}`);
        const room = await Room.findById(roomId);
        if (!room) {
          console.error(`방을 찾을 수 없음: ${roomId}`);
          if (callback) callback("존재하지 않는 방입니다.");
          socket.emit("error", { message: "존재하지 않는 방입니다." });
          return;
        }

        // 방 생성자 정보 가져오기
        const creator = await User.findById(room.creator);
        console.log("방 생성자 정보:", {
          creatorId: room.creator.toString(),
          creatorUsername: creator ? creator.username : "알 수 없음",
          requestUserId: userId,
          requestUsername: username,
        });

        // 방 생성자만 삭제할 수 있도록 체크 (ID와 사용자 이름 모두 확인)
        const isCreatorById = room.creator.toString() === userId;
        const isCreatorByName = creator && creator.username === username;

        console.log("방 생성자 확인:", { isCreatorById, isCreatorByName });

        // 방 생성자 ID가 일치하거나 생성자 이름이 요청자와 같으면 삭제 허용
        // (보안 레벨에 따라 조건 조정 가능)
        if (!isCreatorById && !isCreatorByName) {
          if (callback) callback("채팅방을 삭제할 권한이 없습니다.");
          socket.emit("error", { message: "채팅방을 삭제할 권한이 없습니다." });
          return;
        }

        // 방에 있는 모든 사용자를 방에서 나가게 함
        const usersInRoom = getUsersInRoom(room._id.toString());
        usersInRoom.forEach((user) => {
          if (user) removeUserFromRoom(user.guid); // inRoom false 처리
          io.to(user.id).emit("forceLeave", { roomId });
        });

        // MongoDB에서 방 삭제
        await Room.findByIdAndDelete(roomId);

        // 방 목록 업데이트
        updateRoomsList(io);

        // 온라인 사용자 목록 업데이트
        updateOnlineUsers(io);

        // 콜백 호출 (성공)
        if (callback) callback(null);
      } catch (error) {
        console.error("채팅방 삭제 처리 중 오류:", error);
        if (callback) callback("채팅방 삭제 처리 중 오류가 발생했습니다.");
        socket.emit("error", {
          message: "채팅방 삭제 처리 중 오류가 발생했습니다.",
        });
      }
    });

    // 모든 채팅방과 사용자 데이터 삭제 (관리자 전용)
    socket.on("deleteAllData", async ({ adminUsername }, callback) => {
      try {
        console.log("모든 데이터 삭제 요청 수신:", { adminUsername });

        // 관리자 권한 체크 (사용자 이름이 '까리' 또는 '관리자'인지 확인)
        if (
          !adminUsername ||
          (adminUsername.toLowerCase() !== "까리" &&
            adminUsername.toLowerCase() !== "관리자")
        ) {
          console.error(
            "관리자 권한이 없는 사용자가 데이터 삭제 시도:",
            adminUsername
          );
          if (callback) callback("이 작업은 관리자만 수행할 수 있습니다.");
          socket.emit("error", { message: "권한이 없습니다." });
          return;
        }

        // 1. 모든 방 삭제
        console.log("모든 채팅방 삭제 시작");
        const deletedRooms = await Room.deleteMany({});
        console.log(
          `${deletedRooms.deletedCount}개의 채팅방이 삭제되었습니다.`
        );

        // 2. 모든 사용자 삭제 (관리자 사용자는 제외)
        console.log("모든 사용자 삭제 시작 (관리자 제외)");
        const deletedUsers = await User.deleteMany({
          $and: [
            { username: { $ne: "까리" } },
            { username: { $ne: "관리자" } },
          ],
        });
        console.log(
          `${deletedUsers.deletedCount}명의 사용자가 삭제되었습니다.`
        );

        // 방 목록 업데이트
        updateRoomsList(io);

        // 온라인 사용자 목록 업데이트
        updateOnlineUsers(io);

        // 모든 클라이언트에게 데이터가 리셋되었음을 알림
        io.emit("dataReset", {
          message: "관리자에 의해 모든 데이터가 초기화되었습니다.",
        });

        // 콜백 호출 (성공)
        if (callback) callback(null);
      } catch (error) {
        console.error("데이터 삭제 처리 중 오류:", error);
        if (callback) callback("데이터 삭제 처리 중 오류가 발생했습니다.");
        socket.emit("error", {
          message: "데이터 삭제 처리 중 오류가 발생했습니다.",
        });
      }
    });

    // 연결 해제 처리
    socket.on("disconnect", async () => {
      try {
        const user = getUserBySocketId(socket.id);
        if (user) {
          console.log(
            `사용자 연결 끊김: ${user.username}, 방: ${user.room || "없음"}`
          );

          // 사용자가 방에 있는 경우 처리
          if (user.room) {
            try {
              // MongoDB에서 방 정보 가져오기
              const room = await Room.findOne({ name: user.room });
              if (room) {
                // MongoDB 사용자 정보 가져오기
                const mongoUser = await User.findById(user.guid);
                if (mongoUser) {
                  // 마지막 활동 시간 업데이트
                  mongoUser.lastActive = new Date();
                  await mongoUser.save();

                  // 방 참여자 목록에서 사용자 제거
                  room.participants = room.participants.filter(
                    (participant) =>
                      participant.user &&
                      participant.user.toString() !== user.guid
                  );

                  // 참여자가 없으면 방 삭제
                  if (room.participants.length === 0) {
                    console.log(
                      `연결 끊김으로 참여자가 없어, 방 삭제: ${room.name}`
                    );

                    // 방에 있는 모든 사용자에게 방 삭제 알림
                    io.to(room.name).emit("roomDeleted", { roomId: room._id });

                    // MongoDB에서 방 삭제
                    await Room.findByIdAndDelete(room._id);
                  } else {
                    // 참여자가 아직 남아있으면 방 정보 저장
                    await room.save();
                  }
                }
              } else {
                // 방이 이미 삭제된 경우
                console.log(`disconnect: 이미 삭제된 방(${user.room})`);
              }
            } catch (err) {
              console.error("연결 해제 처리 중 방 정보 업데이트 오류:", err);
            }
          }

          // 10초 후에만 사용자 완전 제거 (재연결 시 타이머 취소)
          disconnectTimers[socket.id] = setTimeout(async () => {
            if (user) {
              removeUser(user.guid);
              // DB에서도 사용자 삭제
              try {
                await User.deleteOne({ guid: user.guid });
                console.log(`DB에서 사용자 삭제: ${user.guid}`);
              } catch (err) {
                console.error("DB 사용자 삭제 중 오류:", err);
              }
            }
            updateRoomsList(io);
            updateOnlineUsers(io);
            console.log(`지연 후 사용자 제거: ${socket.id}`);
          }, 10000);
        }
      } catch (error) {
        console.error("연결 해제 처리 중 오류:", error);
      }
    });
  });

  return io;
};

module.exports = initializeSocket;
