const users = [];

// guid 기준으로 사용자 추가/갱신
const addUser = ({ id, username, room, roomId, guid }) => {
  username = username.trim().toLowerCase();
  room = room.trim(); // _id는 대소문자 구분 없음
  if (!username || !room || !guid) {
    return { error: "사용자 이름, 방 id, guid가 필요합니다." };
  }
  // guid로 기존 사용자 찾기
  let user = users.find((u) => u.guid === guid);
  if (user) {
    // 기존 사용자의 소켓 id, 방, 상태만 갱신
    user.id = id;
    user.username = username;
    user.room = room; // 방 이름으로 저장
    user.roomId = roomId || user.roomId; // 방 ID 저장
    user.inRoom = true;
    return { user, alreadyInRoom: false };
  }
  // 새 사용자 추가
  user = { id, username, room, roomId, guid, inRoom: true };
  users.push(user);
  return { user, alreadyInRoom: false };
};

const addUserWithoutRoom = ({ id, username, guid }) => {
  username = username.trim().toLowerCase();
  if (!username || !guid) {
    return { error: "사용자 이름, guid가 필요합니다." };
  }
  let user = users.find((u) => u.guid === guid);
  if (user) {
    user.id = id;
    user.username = username;
    user.inRoom = false;
    user.room = null;
    return { user };
  }
  user = { id, username, guid, inRoom: false, room: null };
  users.push(user);
  return { user };
};

const removeUser = (guid) => {
  const index = users.findIndex((user) => user.guid === guid);
  if (index !== -1) {
    const removedUser = users.splice(index, 1)[0];
    return removedUser;
  }
  return undefined;
};

const getUser = (guid) => {
  return users.find((user) => user.guid === guid);
};

const getUserBySocketId = (id) => {
  return users.find((user) => user.id === id);
};

const getUsersInRoom = (roomId) => {
  return users.filter(
    (user) => (user.room === roomId || user.roomId === roomId) && user.inRoom
  );
};

const getAllUsers = () => {
  return users;
};

const getIdleUsers = () => {
  return users.filter((user) => !user.inRoom);
};

const getTotalUsers = () => {
  return users;
};

const removeUserFromRoom = (guid) => {
  const user = getUser(guid);
  if (user) {
    user.room = null;
    user.roomId = null;
    user.inRoom = false;
    return user;
  }
  return null;
};

module.exports = {
  addUser,
  addUserWithoutRoom,
  removeUser,
  getUser,
  getUserBySocketId,
  getUsersInRoom,
  getAllUsers,
  getIdleUsers,
  getTotalUsers,
  removeUserFromRoom,
};
