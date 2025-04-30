import React, { useState, useEffect, useRef, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSocket } from "../contexts/SocketContext";
import { useAuth } from "../contexts/AuthContext";
import MessageList from "../components/MessageList";
import Sidebar from "../components/Sidebar";

const ChatPage = () => {
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [showSidebar, setShowSidebar] = useState(false); // 모바일에서 사이드바 표시 여부
  const { messages, roomData, sendMessage, leaveRoom, joinRoom, socket } =
    useSocket();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const joinAttemptedRef = useRef(false);
  const isLeavingRef = useRef(false);

  // URL에서 username과 room 추출
  const searchParams = new URLSearchParams(location.search);
  const username = searchParams.get("username");
  const room = searchParams.get("room");
  const roomIdParam = searchParams.get("roomId"); // URL에서 방 ID 추출

  // 현재 사용자가 방 생성자인지 확인 (이름과 ID를 모두 확인)
  const isCreator = useMemo(() => {
    if (!roomData?.creator || !user) return false;

    // 1. 사용자 이름이 방 생성자와 같은지 확인
    const nameMatches = roomData.creator.username === username;

    // 2. 로그에 방 생성자 ID와 현재 사용자 ID 출력
    console.log("Creator check:", {
      creatorId: roomData.creator._id,
      userId: user._id,
      nameMatches,
    });

    // 사용자 이름과 방 생성자 ID가 일치하는 경우만 true 반환
    return nameMatches && String(roomData.creator._id) === String(user._id);
  }, [roomData, user, username]);

  // 디버깅: 생성자 정보 출력
  useEffect(() => {
    if (roomData?.creator && user) {
      console.log("생성자 확인 정보:", {
        roomCreator: roomData.creator,
        roomCreatorId: roomData.creator._id,
        currentUser: user,
        currentUserId: user._id,
        isEqual: String(roomData.creator._id) === String(user._id),
        isCreator: isCreator,
        roomData: roomData,
      });
    }
  }, [roomData, user, isCreator]);

  // 디버깅: 페이지 로드 시 파라미터 출력
  useEffect(() => {
    console.log("ChatPage 마운트:", {
      username,
      room,
      location: location.search,
    });

    // 사용자 이름이나 방 이름이 없으면 방 목록으로 리다이렉트
    if (!username || !room) {
      console.error("사용자 이름 또는 방 이름 없음:", { username, room });
      navigate("/rooms");
      return;
    }

    // 방 나가기 중인 경우 방 참여를 시도하지 않음
    if (isLeavingRef.current) {
      console.log("방 나가기 처리 중이므로 참여 시도하지 않음");
      return;
    }

    // roomData가 이미 있고 일치하면 방 참여 시도하지 않음
    if (roomData && roomData.room === room.toLowerCase()) {
      console.log("이미 같은 방에 참여 중입니다:", roomData.room);
      setIsLoading(false);
      return;
    }

    // beforeunload 이벤트 리스너 등록 - 페이지를 떠날 때 방 나가기 처리
    const handleBeforeUnload = (e) => {
      if (socket && roomData && roomData.room) {
        console.log("페이지 떠남: socket.emit('leave') 직접 호출");
        socket.emit("leave", {});
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    // 컴포넌트 unmount 시 리스너 제거 및 방 나가기
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);

      // 컴포넌트 언마운트 시에도 직접 socket.emit("leave") 호출
      if (socket && roomData && roomData.room) {
        console.log("컴포넌트 언마운트: socket.emit('leave') 직접 호출");
        socket.emit("leave", {});
      }
    };
  }, [socket, roomData, username, room, navigate]);

  // 컴포넌트 언마운트 시 joinAttemptedRef 초기화
  useEffect(() => {
    return () => {
      // 무조건 초기화 (방 나가기 후 재입장 시 joinRoom이 반드시 호출되도록)
      joinAttemptedRef.current = false;
      isLeavingRef.current = false;
    };
  }, []);

  // 방 데이터가 로드되면 로딩 상태 해제
  useEffect(() => {
    if (
      roomData &&
      roomData.room &&
      roomData.users &&
      roomData.users.length > 0
    ) {
      setIsLoading(false);
    }
  }, [roomData]);

  // 메시지가 추가될 때마다 스크롤 맨 아래로 이동
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (message.trim()) {
      sendMessage(message, () => {
        // 메시지 전송 후 입력 필드 비우기
        setMessage("");
      });
    }
  };

  // 채팅방 나가기 핸들러
  const handleLeaveRoom = () => {
    console.log("방 나가기 버튼 클릭");
    setIsLoading(true); // 로딩 상태 활성화
    isLeavingRef.current = true; // 나가기 상태 설정
    joinAttemptedRef.current = false; // 참여 상태 초기화

    // 방 나가기 요청
    leaveRoom(() => {
      // leaveRoom 콜백에서 상태 초기화
      isLeavingRef.current = false;
      joinAttemptedRef.current = false;
      setIsLoading(false);
      // 방 목록 페이지로 이동
      navigate("/rooms");
    });
  };

  // 채팅방 삭제 핸들러
  const handleDeleteRoom = () => {
    if (window.confirm(`정말로 "${roomData.room}" 방을 삭제하시겠습니까?`)) {
      setIsLoading(true); // 로딩 상태 활성화
      isLeavingRef.current = true; // 나가기 상태 설정

      if (socket) {
        // 디버깅을 위한 상세 정보 출력
        console.log("방 삭제 요청 상세 정보:", {
          roomData: roomData,
          roomId: roomData._id,
          roomIdToString: roomData._id?.toString(),
          userId: user._id,
          username: username,
        });

        socket.emit(
          "deleteRoom",
          {
            roomId: roomIdParam || roomData.roomId || roomData._id?.toString(), // URL 파라미터의 roomId 우선 사용
            userId: user._id,
            username: username,
          },
          (error) => {
            if (error) {
              console.error("방 삭제 실패:", error);
              alert(`방 삭제 중 오류가 발생했습니다: ${error}`);
              setIsLoading(false);
            } else {
              console.log("방 삭제 성공");
              navigate("/rooms");
            }
          }
        );
      }
    }
  };

  if (!username || !room) {
    return null; // 데이터가 없으면 렌더링하지 않음
  }

  // 로딩 화면 표시
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-center">
          <div className="inline-block w-12 h-12 mb-4 border-4 rounded-full animate-spin border-slate-300 border-t-slate-700"></div>
          <p className="text-lg font-medium text-slate-700">
            채팅방에 연결 중...
          </p>
          <p className="mt-2 text-sm text-slate-500">잠시만 기다려 주세요</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* 모바일에서 사이드바 오버레이 */}
      {showSidebar && (
        <div className="fixed inset-0 z-20 block md:hidden">
          <div
            className="absolute inset-0 bg-opacity-50 bg-slate-900"
            onClick={() => setShowSidebar(false)}
          ></div>
          <div className="absolute top-0 bottom-0 left-0 w-64 p-5 text-white bg-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white/90">방 정보</h2>
              <button
                onClick={() => setShowSidebar(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-700"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <Sidebar roomData={roomData} />
          </div>
        </div>
      )}

      {/* 데스크톱에서 사이드바 (기본 보임) */}
      <div className="flex-shrink-0 hidden h-full md:w-64 md:flex">
        <Sidebar roomData={roomData} />
      </div>

      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-3 bg-white border-b shadow-sm border-slate-200">
          <div className="flex items-center">
            {/* 모바일에서 사이드바 토글 버튼 */}
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-2 mr-2 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 md:hidden"
              aria-label="방 정보 표시"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </button>
            <h2 className="text-xl font-semibold text-slate-700">
              채팅방: {roomData.room || room}
            </h2>
          </div>
          <div className="flex space-x-2">
            {isCreator && (
              <button
                onClick={handleDeleteRoom}
                className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                방 삭제
              </button>
            )}
            <button
              onClick={handleLeaveRoom}
              className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              나가기
            </button>
          </div>
        </div>

        <div className="flex-1 p-4 overflow-y-auto bg-white">
          <MessageList messages={messages} />
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 bg-white border-t border-slate-200">
          <form onSubmit={handleSubmit} className="flex space-x-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="메시지를 입력하세요"
              className="flex-1 px-4 py-2 transition-colors border rounded-full border-slate-300 bg-slate-50 text-slate-700 placeholder-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none focus:ring-0"
              autoComplete="off"
              disabled={!roomData.room}
            />
            <button
              type="submit"
              className="px-6 py-2 font-semibold text-white transition-colors rounded-full shadow-sm bg-slate-700 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
              disabled={!roomData.room || !message.trim()}
            >
              전송
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
