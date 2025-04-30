import React, { useEffect, useState } from "react";
import { useSocket } from "../contexts/SocketContext";
import { useAuth } from "../contexts/AuthContext";
import { deleteRoom } from "../api/roomApi";

const ChatRoom = ({ room }) => {
  const { socket } = useSocket();
  const { user } = useAuth();
  const [error, setError] = useState(null);

  // 디버깅: 생성자 정보 출력
  useEffect(() => {
    if (room?.creator && user) {
      console.log("ChatRoom - 생성자 확인 정보:", {
        roomCreator: room.creator,
        roomCreatorId: room.creator._id,
        currentUser: user,
        currentUserId: user._id,
        isEqual:
          room.creator._id &&
          user._id &&
          String(room.creator._id) === String(user._id),
      });
    }
  }, [room, user]);

  useEffect(() => {
    // 채팅방 삭제 이벤트 리스너
    socket.on("roomDeleted", ({ roomId }) => {
      if (roomId === room._id) {
        // 현재 방이 삭제된 경우 처리
        // 예: 채팅방 목록 페이지로 이동
        window.location.href = "/rooms";
      }
    });

    // 강제 퇴장 이벤트 리스너
    socket.on("forceLeave", ({ roomId }) => {
      if (roomId === room._id) {
        // 현재 방에서 강제 퇴장된 경우 처리
        // 예: 채팅방 목록 페이지로 이동
        window.location.href = "/rooms";
      }
    });

    return () => {
      socket.off("roomDeleted");
      socket.off("forceLeave");
    };
  }, [socket, room._id]);

  const handleDeleteRoom = async () => {
    try {
      if (window.confirm("정말로 이 채팅방을 삭제하시겠습니까?")) {
        // API를 통한 삭제
        await deleteRoom(room._id, user._id);

        // Socket.IO를 통한 실시간 삭제
        socket.emit("deleteRoom", { roomId: room._id, userId: user._id });
      }
    } catch (error) {
      setError(error.message);
    }
  };

  // 사용자가 방 생성자인지 확인 (ID로 비교)
  const isCreator =
    room?.creator && user && String(room.creator._id) === String(user._id);

  return (
    <div className="chat-room">
      <div className="chat-room-header">
        <h2>{room.name}</h2>
        {isCreator && (
          <button className="delete-room-btn" onClick={handleDeleteRoom}>
            채팅방 삭제
          </button>
        )}
      </div>
      {error && <div className="error-message">{error}</div>}
      {/* 기존 채팅방 컴포넌트 내용 */}
    </div>
  );
};

export default ChatRoom;
