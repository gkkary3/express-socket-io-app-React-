import React, { useEffect } from "react";

const Sidebar = ({ roomData }) => {
  // 참여자 목록 디버깅
  useEffect(() => {
    if (roomData && roomData.users) {
      console.log("사이드바 참여자 목록:", roomData.users);
    }
  }, [roomData]);

  // 사용자 배열이 있는지 확인하고, 모든 참여자 표시
  const users = roomData.users || [];

  return (
    <div className="flex h-full w-full flex-col bg-slate-800 p-5 text-white md:w-64">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-white/90">
          방 이름: {roomData.room}
        </h2>
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <h3 className="mb-2 text-sm font-medium uppercase tracking-wider text-slate-400">
          참여자 ({users.length})
        </h3>
        <div className="flex-1 overflow-y-auto">
          <ul className="space-y-1 pr-1">
            {users.length > 0 ? (
              users.map((user, index) => (
                <li
                  key={user.id || index}
                  className="flex items-center rounded-md py-2 px-3 transition-colors hover:bg-slate-700/50"
                >
                  <div className="mr-2 h-2 w-2 rounded-full bg-emerald-400"></div>
                  <span className="text-slate-200">{user.username}</span>
                </li>
              ))
            ) : (
              <li className="py-2 px-3 text-slate-400">참여자가 없습니다</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
