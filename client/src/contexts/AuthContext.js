import React, { createContext, useContext, useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { useSocket } from "./SocketContext";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const { login: socketLogin } = useSocket();

  // 소켓 연결 복구 시 자동 로그인 (localStorage 사용 안함)
  useEffect(() => {
    // 더 이상 자동 로그인 로직 없음
  }, []);

  // 로그인 성공 시 user 상태 복구
  useEffect(() => {
    // 더 이상 socket 이벤트 리스너 필요 없음
  }, []);

  // 로그아웃/새로고침/창 닫기 시에만 user를 null로
  useEffect(() => {
    const handleUnload = () => {
      setUser(null);
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, []);

  // guid를 localStorage에서 관리
  const getGuid = () => {
    let guid = localStorage.getItem("user_guid");
    if (!guid) {
      guid = uuidv4();
      localStorage.setItem("user_guid", guid);
    }
    return guid;
  };

  // login 함수: guid를 항상 함께 전달
  const login = (username) => {
    return new Promise((resolve, reject) => {
      const guid = getGuid();
      socketLogin(username, guid, (err, data) => {
        if (err) {
          reject(err);
        } else {
          // _id를 string으로 변환해서 저장
          const user = { ...data.user, _id: String(data.user._id) };
          setUser(user);
          resolve(user);
        }
      });
    });
  };

  // logout 함수: user 상태와 guid 모두 삭제
  const logout = () => {
    setUser(null);
    localStorage.removeItem("user_guid");
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
