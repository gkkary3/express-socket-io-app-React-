import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { io } from "socket.io-client";
import { useNavigate } from "react-router-dom";

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [roomData, setRoomData] = useState({ room: "", users: [] });
  const [username, setUsername] = useState("");
  const [rooms, setRooms] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const socketRef = useRef(null);

  // 소켓 이벤트 리스너 등록 함수
  const registerSocketListeners = (sock) => {
    if (!sock) return;
    sock.on("message", messageHandler);
    sock.on("roomData", roomDataHandler);
    sock.on("userJoined", userJoinedHandler);
    sock.on("userLeft", userLeftHandler);
    sock.on("roomDeleted", roomDeletedHandler);
    sock.on("forceLeave", forceLeaveHandler);
    sock.on("roomsList", (roomsList) => {
      setRooms(roomsList);
    });
    sock.on("onlineUsers", (users) => {
      setOnlineUsers(users);
    });
  };

  // 소켓 이벤트 리스너 해제 함수
  const unregisterSocketListeners = (sock) => {
    if (!sock) return;
    sock.off("message", messageHandler);
    sock.off("roomData", roomDataHandler);
    sock.off("userJoined", userJoinedHandler);
    sock.off("userLeft", userLeftHandler);
    sock.off("roomDeleted", roomDeletedHandler);
    sock.off("forceLeave", forceLeaveHandler);
    sock.off("roomsList");
    sock.off("onlineUsers");
  };

  // 메시지 관련 핸들러들 (useCallback으로 선언)
  const messageHandler = useCallback((message) => {
    setMessages((prevMessages) => [...prevMessages, message]);
  }, []);
  const roomDataHandler = useCallback((data) => {
    setRoomData(data);
  }, []);
  const userJoinedHandler = useCallback((data) => {
    setRoomData((prevRoomData) => {
      if (!prevRoomData || !prevRoomData.users) return prevRoomData;
      const userExists = prevRoomData.users.some(
        (u) => u.id && data.user.id && u.id === data.user.id
      );
      if (!userExists) {
        return {
          ...prevRoomData,
          users: [
            ...prevRoomData.users,
            { username: data.user.username, id: data.user.id },
          ],
        };
      }
      return prevRoomData;
    });
  }, []);
  const userLeftHandler = useCallback((data) => {
    setRoomData((prevRoomData) => {
      if (!prevRoomData || !prevRoomData.users) {
        return prevRoomData;
      }
      return {
        ...prevRoomData,
        users: prevRoomData.users.filter((u) => u.id !== data.user.id),
      };
    });
    const leaveMessage = {
      type: "notice",
      text: `${data.user.username}님이 채팅방을 나가셨습니다.`,
      timestamp: new Date(),
      createdAt: new Date(),
    };
    setMessages((prevMessages) => [...prevMessages, leaveMessage]);
  }, []);
  const roomDeletedHandler = useCallback(
    (data) => {
      setMessages([]);
      setRoomData({ room: "", users: [] });
      setIsLoading && setIsLoading(false);
      navigate("/rooms");
    },
    [navigate]
  );
  const forceLeaveHandler = useCallback(
    (data) => {
      setMessages([]);
      setRoomData({ room: "", users: [] });
      navigate("/rooms");
    },
    [navigate]
  );

  // 소켓 연결 함수 (로그인 시에만 호출)
  const connectSocket = useCallback(() => {
    if (socketRef.current && socketRef.current.connected)
      return socketRef.current;
    const newSocket = io(
      process.env.REACT_APP_API_URL || "http://localhost:4000"
    );
    socketRef.current = newSocket;
    setSocket(newSocket);
    registerSocketListeners(newSocket);
    return newSocket;
  }, []);

  // 채팅방 참가 함수
  const joinRoom = (username, guid, roomId, callback) => {
    setMessages([]);
    setUsername(username);
    if (!socketRef.current || !socketRef.current.connected) {
      // 소켓이 없으면 연결 후 join
      const sock = connectSocket();
      sock.on("connect", () => {
        sock.emit("join", { username, guid, roomId });
      });
    } else {
      socketRef.current.emit("join", { username, guid, roomId });
    }
    // joinSuccess, error 리스너는 기존과 동일하게...
    let timeoutId = null;
    if (callback) {
      timeoutId = setTimeout(() => {
        callback("서버 연결에 시간이 너무 오래 걸립니다. 다시 시도해주세요.");
      }, 10000);
    }
    const successHandler = (data) => {
      if (timeoutId) clearTimeout(timeoutId);
      setRoomData({
        room: data.room, // 방 이름
        roomId: data.roomId, // 방 ID
        users: data.users || [],
        _id: data._id,
        creator: data.creator,
      });
      if (callback) callback(null);
      socketRef.current.off("joinSuccess", successHandler);
      socketRef.current.off("error", errorHandler);
    };
    const errorHandler = (error) => {
      if (timeoutId) clearTimeout(timeoutId);
      if (callback) callback(error.message);
      socketRef.current.off("joinSuccess", successHandler);
      socketRef.current.off("error", errorHandler);
    };
    socketRef.current.on("joinSuccess", successHandler);
    socketRef.current.on("error", errorHandler);
  };

  // 메시지 전송 함수
  const sendMessage = (message, callback) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit("sendMessage", message, callback);
    }
  };

  // 채팅방 나가기 함수
  const leaveRoom = (callback) => {
    if (socketRef.current && socketRef.current.connected) {
      const successHandler = () => {
        setMessages([]);
        setRoomData({ room: "", users: [] });
        if (callback) callback(null);
        navigate("/rooms");
        socketRef.current?.off("leaveSuccess", successHandler);
        socketRef.current?.off("error", errorHandler);
      };
      const errorHandler = (error) => {
        setMessages([]);
        setRoomData({ room: "", users: [] });
        if (callback) callback(error.message);
        navigate("/rooms");
        socketRef.current?.off("leaveSuccess", successHandler);
        socketRef.current?.off("error", errorHandler);
      };
      socketRef.current.on("leaveSuccess", successHandler);
      socketRef.current.on("error", errorHandler);
      socketRef.current.emit("leave", {});
      setTimeout(() => {
        if (socketRef.current && socketRef.current.connected) {
          socketRef.current.emit("getRooms");
        }
      }, 300);
    }
  };

  // 로그인 함수 (로그인 시에만 소켓 연결)
  const login = (username, guid, callback) => {
    const sock = connectSocket();
    setUsername(username);
    sock.on("loginSuccess", (data) => {
      if (callback) callback(null, data);
    });
    sock.on("error", (error) => {
      if (callback) callback(error);
    });
    sock.emit("login", { username, guid });
  };

  // 로그아웃 함수 (소켓 완전 해제)
  const logout = () => {
    if (socketRef.current) {
      unregisterSocketListeners(socketRef.current);
      socketRef.current.disconnect();
      setSocket(null);
      socketRef.current = null;
    }
    setUsername("");
    setMessages([]);
    setRoomData({ room: "", users: [] });
  };

  // 방 목록 요청 함수
  const requestRooms = useCallback(() => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit("getRooms");
    }
  }, []);

  useEffect(() => {
    // 언마운트 시 소켓 해제
    return () => {
      if (socketRef.current) {
        unregisterSocketListeners(socketRef.current);
        socketRef.current.disconnect();
        setSocket(null);
        socketRef.current = null;
      }
    };
  }, []);

  return (
    <SocketContext.Provider
      value={{
        socket,
        messages,
        roomData,
        joinRoom,
        sendMessage,
        leaveRoom,
        username,
        setUsername,
        rooms,
        onlineUsers,
        login,
        logout,
        requestRooms,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};
