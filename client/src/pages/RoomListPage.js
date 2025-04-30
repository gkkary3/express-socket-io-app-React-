import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../contexts/SocketContext";
import { useAuth } from "../contexts/AuthContext";

const RoomListPage = () => {
  const [showModal, setShowModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [roomError, setRoomError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentView, setCurrentView] = useState("grid"); // grid 또는 list 뷰
  const [visibleCount, setVisibleCount] = useState(12); // 처음에 보여줄 방 개수
  const [hasMore, setHasMore] = useState(true); // 더 불러올 방이 있는지
  const [showUserList, setShowUserList] = useState(false); // 모바일에서 사용자 목록 토글용
  const { user } = useAuth();
  const { socket, logout } = useSocket();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const {
    rooms,
    onlineUsers,
    joinRoom,
    username: socketUsername,
    requestRooms,
    leaveRoom,
  } = useSocket();

  const username = user?.username || socketUsername;
  const isAdmin =
    username?.toLowerCase() === "까리" || username?.toLowerCase() === "관리자";

  const observer = useRef();

  // 무한 스크롤 관찰 요소에 대한 참조 생성
  const lastRoomElementRef = useCallback(
    (node) => {
      if (isLoading) return;
      if (observer.current) observer.current.disconnect();

      observer.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasMore) {
            // 방 목록을 더 불러올 수 있을 때 방 개수 증가
            setVisibleCount((prevVisibleCount) => {
              const newCount = prevVisibleCount + 8; // 한 번에 8개씩 더 불러옴
              // 모든 방을 다 불러왔는지 확인
              if (newCount >= filteredRooms.length) {
                setHasMore(false);
              }
              return newCount;
            });
          }
        },
        { threshold: 0.5 }
      );

      if (node) observer.current.observe(node);
    },
    [isLoading, hasMore]
  );

  // 컴포넌트 마운트 시 방 목록 요청
  useEffect(() => {
    console.log("RoomListPage 마운트:", { user, username, socketUsername });
    // 사용자 이름이 없으면 로그인 페이지로 리다이렉트
    if (!username && !user) {
      console.log("사용자 이름이 없어 로그인 페이지로 이동");
      navigate("/");
      return;
    }

    // 방 목록 요청
    requestRooms();

    // 주기적으로 방 목록 업데이트 (10초 간격)
    const interval = setInterval(() => {
      requestRooms();
    }, 10000);

    return () => {
      clearInterval(interval);
    };
  }, [username, user, navigate, requestRooms]);

  useEffect(() => {
    if (!user) {
      setLoading(true);
      // 2초 대기 후에도 user가 없으면 JoinPage로 이동
      const timer = setTimeout(() => {
        if (!user) {
          navigate("/");
        }
      }, 2000);
      return () => clearTimeout(timer);
    } else {
      setLoading(false);
    }
  }, [user, navigate]);

  // 검색어로 방 필터링
  const filteredRooms =
    rooms?.filter((room) =>
      room.name.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

  // 검색어 변경 시 표시되는 방 개수 리셋
  useEffect(() => {
    setVisibleCount(12);
    setHasMore(filteredRooms.length > 12);
  }, [searchTerm, filteredRooms.length]);

  // 화면에 표시될 방 목록 (무한 스크롤로 제한된 개수)
  const visibleRooms = filteredRooms.slice(0, visibleCount);

  const handleCreateRoom = (e) => {
    e.preventDefault();

    if (!newRoomName.trim()) {
      setRoomError("방 이름을 입력해주세요.");
      return;
    }

    setIsLoading(true);
    console.log(`방 생성 시도: ${newRoomName}`);

    const guid = localStorage.getItem("user_guid");

    // 현재 사용자의 방 참여 상태 확인
    const isCurrentlyInRoom = onlineUsers?.find(
      (user) => user.username === username && user.inRoom
    );

    // 방 생성 함수 - createRoom 이벤트를 사용해 새 방 생성 후 입장
    const createAndJoinRoom = () => {
      if (!socket) {
        setRoomError("소켓 연결이 없습니다.");
        setIsLoading(false);
        return;
      }

      // createRoom 이벤트로 방 생성 요청
      socket.emit(
        "createRoom",
        { username, roomName: newRoomName },
        (err, data) => {
          if (err || !data) {
            setRoomError(err || "방 생성 실패");
            setIsLoading(false);
            return;
          }

          // 방 생성 성공 시 roomId로 joinRoom 호출
          joinRoom(username, guid, data._id, (joinError) => {
            if (joinError) {
              setRoomError(joinError);
              setIsLoading(false);
            } else {
              setShowModal(false);
              navigate(
                `/chat?username=${username}&room=${newRoomName}&roomId=${data._id}`
              );
            }
          });
        }
      );
    };

    if (isCurrentlyInRoom) {
      // 먼저 방에서 나가고 새 방 생성
      leaveRoom((error) => {
        if (error) {
          setRoomError("기존 방에서 나가는 데 문제가 발생했습니다.");
          setIsLoading(false);
          return;
        }
        setTimeout(() => {
          createAndJoinRoom();
        }, 300);
      });
    } else {
      createAndJoinRoom();
    }
  };

  const handleJoinRoom = (roomId, roomName) => {
    setIsLoading(true);
    const guid = localStorage.getItem("user_guid");
    const isCurrentlyInRoom = onlineUsers?.find(
      (user) => user.username === username && user.inRoom
    );

    // roomId로 입장
    const joinWithRoomId = () => {
      joinRoom(username, guid, roomId, (error) => {
        if (error) {
          setIsLoading(false);
        } else {
          navigate(
            `/chat?username=${username}&room=${roomName}&roomId=${roomId}`
          );
        }
      });
    };

    if (isCurrentlyInRoom) {
      leaveRoom((error) => {
        setTimeout(() => {
          joinWithRoomId();
        }, 100);
      });
    } else {
      joinWithRoomId();
    }
  };

  // 홈으로 돌아가기 (소켓 연결 끊음)
  const handleGoHome = () => {
    // 소켓 연결 끊기
    if (socket) {
      socket.disconnect();
    }
    // 로그아웃 처리
    logout();
    // JoinPage로 이동
    navigate("/");
  };

  // 모든 채팅방 및 사용자 데이터 삭제
  const handleDeleteAllData = () => {
    if (!isAdmin) return;

    if (
      window.confirm(
        "정말로 모든 채팅방과 사용자 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
      )
    ) {
      setIsLoading(true);

      // 서버에 모든 데이터 삭제 요청
      socket.emit("deleteAllData", { adminUsername: username }, (error) => {
        setIsLoading(false);
        if (error) {
          alert(`오류가 발생했습니다: ${error}`);
        } else {
          alert("모든 데이터가 성공적으로 삭제되었습니다.");
          requestRooms(); // 방 목록 갱신
        }
      });
    }
  };

  // 로딩 화면 표시
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-center">
          <div className="inline-block w-12 h-12 mb-4 border-4 rounded-full animate-spin border-slate-300 border-t-slate-700"></div>
          <p className="text-lg font-medium text-slate-700">
            채팅방으로 이동 중...
          </p>
        </div>
      </div>
    );
  }

  // 방 카드 렌더링 컴포넌트
  const RoomCard = ({ room, isLast }) => {
    return (
      <div
        ref={isLast ? lastRoomElementRef : null}
        className="flex flex-col p-4 transition-all bg-white border rounded-lg shadow-sm group border-slate-200 hover:shadow-md"
      >
        <div className="flex-1 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-medium text-slate-800 group-hover:text-slate-900">
              {room.name}
            </h3>
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
              {room.userCount || room.users?.length || 0}명
            </span>
          </div>

          {/* 방 생성자 정보 표시 */}
          {room.creator && (
            <p className="mb-1 text-xs text-slate-400">
              생성자: {room.creator.username || "알 수 없음"}
            </p>
          )}

          {/* 활성 사용자 목록 */}
          <p className="text-sm truncate text-slate-500">
            {room.userCount > 0 || (room.users && room.users.length > 0) ? (
              <>
                <span className="font-medium">참여자:</span>{" "}
                {room.users && room.users.length > 0
                  ? room.users
                      .map((p) => p.username || "")
                      .filter(Boolean)
                      .join(", ")
                  : "참여자 정보 로딩 중"}
              </>
            ) : (
              "아직 참여자가 없습니다"
            )}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleJoinRoom(room._id, room.name);
            }}
            className="w-full px-4 py-2 text-sm font-medium text-white transition-colors rounded-md bg-slate-700 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-500 active:bg-slate-800"
          >
            입장하기
          </button>
        </div>
      </div>
    );
  };

  if (!user && loading) {
    return <div>로그인 복구 중입니다...</div>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* 방 목록 (스크롤 가능 영역) */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* 고정된 상단 컨트롤 영역 */}
        <div className="flex-shrink-0 p-4 bg-white border-b shadow-sm sm:p-6 border-slate-200">
          <div className="flex flex-col mb-4 space-y-4 sm:mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              {/* 상단 좌측 영역 - 모바일에서는 한 줄로 정렬 */}
              <div className="flex items-center mb-3 sm:mb-0">
                <button
                  onClick={handleGoHome}
                  className="flex items-center justify-center w-8 h-8 mr-2 rounded-full sm:w-10 sm:h-10 sm:mr-4 bg-slate-100 text-slate-600 hover:bg-slate-200"
                  aria-label="홈으로 돌아가기"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-4 h-4 sm:w-5 sm:h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                    />
                  </svg>
                </button>
                <h1 className="text-lg font-bold sm:text-2xl text-slate-800">
                  채팅방 목록
                </h1>

                {/* 모바일 화면에서 사용자 목록 토글 버튼 */}
                <button
                  onClick={() => setShowUserList(!showUserList)}
                  className="p-2 ml-2 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 md:hidden"
                  aria-label="사용자 목록 토글"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-4 h-4 sm:w-5 sm:h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                </button>
              </div>

              {/* 모바일 환경에서도 버튼들을 오른쪽에 정렬하기 위해 flex-row를 유지하고 justify-end 추가 */}
              <div className="flex items-center justify-end space-x-1 sm:space-x-2">
                {isAdmin && (
                  <button
                    onClick={handleDeleteAllData}
                    className="px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-white transition-colors rounded-md bg-rose-600 hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
                  >
                    <span className="hidden sm:inline">전체 삭제</span>
                    <span className="sm:hidden">삭제</span>
                  </button>
                )}
                <button
                  onClick={() => setCurrentView("grid")}
                  className={`rounded-md p-1.5 sm:p-2 transition-colors ${
                    currentView === "grid"
                      ? "bg-slate-700 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                  aria-label="그리드 보기"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-4 h-4 sm:w-5 sm:h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                    />
                  </svg>
                </button>
                <button
                  onClick={() => setCurrentView("list")}
                  className={`rounded-md p-1.5 sm:p-2 transition-colors ${
                    currentView === "list"
                      ? "bg-slate-700 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                  aria-label="리스트 보기"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-4 h-4 sm:w-5 sm:h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  </svg>
                </button>
                <button
                  onClick={() => setShowModal(true)}
                  className="px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-white transition-colors rounded-md bg-slate-700 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
                >
                  <span className="hidden sm:inline">방 만들기</span>
                  <span className="sm:hidden">방 만들기</span>
                </button>
              </div>
            </div>

            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="방 이름 검색..."
                className="w-full px-4 py-2 pr-10 bg-white border rounded-lg border-slate-300 text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
                <svg
                  className="w-5 h-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>
                전체 {rooms?.length || 0}개의 방, {filteredRooms.length}개
                검색됨, {visibleRooms.length}개 표시 중
              </span>
              {filteredRooms.length === 0 && searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="underline text-slate-700 hover:text-slate-900"
                >
                  검색 초기화
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 스크롤 가능한 방 목록 영역 */}
        <div className="flex-1 p-4 overflow-y-auto sm:p-6 sm:pt-4">
          {currentView === "grid" ? (
            // 그리드 뷰
            <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visibleRooms.length > 0 ? (
                visibleRooms.map((room, index) => (
                  <RoomCard
                    key={index}
                    room={room}
                    isLast={index === visibleRooms.length - 1}
                  />
                ))
              ) : (
                <div className="col-span-full flex min-h-[200px] items-center justify-center rounded-lg border border-slate-200 bg-white p-8 text-slate-500">
                  <div className="text-center">
                    {searchTerm ? (
                      <>
                        <p className="mb-2">
                          "{searchTerm}" 검색 결과가 없습니다
                        </p>
                        <p className="text-sm text-slate-400">
                          다른 검색어를 입력하거나 새 방을 만들어보세요.
                        </p>
                      </>
                    ) : (
                      <p>
                        현재 이용 가능한 방이 없습니다. 새로운 방을
                        만들어보세요!
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* 로딩 인디케이터 */}
              {hasMore && visibleRooms.length > 0 && (
                <div className="flex justify-center py-4 col-span-full">
                  <div className="inline-block w-8 h-8 border-4 rounded-full animate-spin border-slate-300 border-t-slate-600"></div>
                </div>
              )}
            </div>
          ) : (
            // 리스트 뷰
            <div className="overflow-hidden bg-white border rounded-lg border-slate-200">
              {visibleRooms.length > 0 ? (
                <div className="divide-y divide-slate-200">
                  {visibleRooms.map((room, index) => (
                    <div
                      key={index}
                      ref={
                        index === visibleRooms.length - 1
                          ? lastRoomElementRef
                          : null
                      }
                      className="flex items-center justify-between p-4 group hover:bg-slate-50"
                    >
                      <div>
                        <h3 className="text-lg font-medium text-slate-800 group-hover:text-slate-900">
                          {room.name}
                        </h3>
                        <p className="text-sm text-slate-500">
                          참여자: {room.userCount || room.users?.length || 0}명
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // 이벤트 버블링 방지
                          handleJoinRoom(room._id, room.name);
                        }}
                        className="relative z-10 px-4 py-2 text-sm font-medium text-white transition-colors rounded-md bg-slate-700 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-500 active:bg-slate-800"
                      >
                        입장하기
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex min-h-[200px] items-center justify-center p-8 text-slate-500">
                  <div className="text-center">
                    {searchTerm ? (
                      <>
                        <p className="mb-2">
                          "{searchTerm}" 검색 결과가 없습니다
                        </p>
                        <p className="text-sm text-slate-400">
                          다른 검색어를 입력하거나 새 방을 만들어보세요.
                        </p>
                      </>
                    ) : (
                      <p>
                        현재 이용 가능한 방이 없습니다. 새로운 방을
                        만들어보세요!
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* 로딩 인디케이터 */}
              {hasMore && visibleRooms.length > 0 && (
                <div className="flex justify-center py-4">
                  <div className="inline-block w-8 h-8 border-4 rounded-full animate-spin border-slate-300 border-t-slate-600"></div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 모바일에서 사용자 목록 오버레이 */}
      {showUserList && (
        <div className="fixed inset-0 z-20 block md:hidden">
          <div
            className="absolute inset-0 bg-opacity-50 bg-slate-900"
            onClick={() => setShowUserList(false)}
          ></div>
          <div className="absolute top-0 bottom-0 right-0 w-64 p-5 text-white bg-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white/90">온라인 사용자</h2>
              <button
                onClick={() => setShowUserList(false)}
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
            <div className="flex flex-col flex-1 overflow-hidden">
              <h3 className="mb-2 text-sm font-medium tracking-wider uppercase text-slate-400">
                접속자 ({onlineUsers?.length || 0})
              </h3>
              <div className="flex-1 overflow-y-auto">
                <ul className="pr-1 space-y-1">
                  {onlineUsers && onlineUsers.length > 0 ? (
                    onlineUsers.map((user, index) => (
                      <li
                        key={index}
                        className="flex flex-col px-3 py-2 transition-colors rounded-md hover:bg-slate-700/50"
                      >
                        <div className="flex items-center">
                          <div
                            className={`mr-2 h-2 w-2 rounded-full ${
                              user.inRoom ? "bg-amber-400" : "bg-emerald-400"
                            }`}
                          ></div>
                          <span className="text-slate-200">
                            {user.username}
                          </span>
                        </div>
                        {user.inRoom && user.room && (
                          <span className="mt-1 ml-4 text-xs text-slate-400">
                            {user.room} 방에 참여 중
                          </span>
                        )}
                        {!user.inRoom && (
                          <span className="mt-1 ml-4 text-xs text-slate-400">
                            대기 중
                          </span>
                        )}
                      </li>
                    ))
                  ) : (
                    <li className="px-3 py-2 text-slate-400">
                      접속자가 없습니다.
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 온라인 사용자 목록 (사이드바) - 데스크톱 */}
      <div className="flex-shrink-0 hidden w-64 p-5 text-white bg-slate-800 md:block">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-white/90">온라인 사용자</h2>
        </div>
        <div className="flex flex-col flex-1 overflow-hidden">
          <h3 className="mb-2 text-sm font-medium tracking-wider uppercase text-slate-400">
            접속자 ({onlineUsers?.length || 0})
          </h3>
          <div className="flex-1 overflow-y-auto">
            <ul className="pr-1 space-y-1">
              {onlineUsers && onlineUsers.length > 0 ? (
                onlineUsers.map((user, index) => (
                  <li
                    key={index}
                    className="flex flex-col px-3 py-2 transition-colors rounded-md hover:bg-slate-700/50"
                  >
                    <div className="flex items-center">
                      <div
                        className={`mr-2 h-2 w-2 rounded-full ${
                          user.inRoom ? "bg-amber-400" : "bg-emerald-400"
                        }`}
                      ></div>
                      <span className="text-slate-200">{user.username}</span>
                    </div>
                    {user.inRoom && user.room && (
                      <span className="mt-1 ml-4 text-xs text-slate-400">
                        {user.room} 방에 참여 중
                      </span>
                    )}
                    {!user.inRoom && (
                      <span className="mt-1 ml-4 text-xs text-slate-400">
                        대기 중
                      </span>
                    )}
                  </li>
                ))
              ) : (
                <li className="px-3 py-2 text-slate-400">접속자가 없습니다.</li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* 방 생성 모달 */}
      {showModal && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-xl">
            <h2 className="mb-4 text-xl font-bold text-slate-800">
              새 채팅방 만들기
            </h2>
            {roomError && (
              <p className="mb-4 text-sm text-rose-500">{roomError}</p>
            )}
            <form onSubmit={handleCreateRoom}>
              <div className="mb-4">
                <label
                  htmlFor="roomName"
                  className="block mb-2 text-sm font-medium text-slate-700"
                >
                  방 이름
                </label>
                <input
                  type="text"
                  id="roomName"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md shadow-sm border-slate-300 placeholder-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  placeholder="방 이름을 입력하세요"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setRoomError("");
                    setNewRoomName("");
                  }}
                  className="px-4 py-2 text-sm font-medium transition-colors bg-white border rounded-md border-slate-300 text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white transition-colors rounded-md bg-slate-700 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
                >
                  만들기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomListPage;
