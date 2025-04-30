const { getUsersInRoom, getAllUsers } = require("./users");

// 모든 활성 방 목록을 가져오는 함수
const getAllRooms = () => {
  const allUsers = getAllUsers();

  // 모든 사용자로부터 고유한 방 이름만 추출
  const roomNames = [
    ...new Set(
      allUsers
        .filter((user) => user.room) // 방이 있는 사용자만 필터링
        .map((user) => user.room)
    ),
  ];

  // 각 방에 대한 정보 구성
  const rooms = roomNames.map((roomName) => {
    const users = getUsersInRoom(roomName);
    return {
      name: roomName,
      users,
      userCount: users.length,
    };
  });

  return rooms;
};

module.exports = {
  getAllRooms,
};
