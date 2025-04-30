import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const JoinPage = () => {
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  // 배경 데코레이션용 가상의 메시지 버블 배열
  const messageBubbles = [
    { text: "안녕하세요!", position: "left", color: "blue" },
    { text: "반가워요!", position: "right", color: "green" },
    { text: "오늘 날씨 좋네요", position: "left", color: "purple" },
    { text: "새로운 친구를 만나서 기뻐요", position: "right", color: "pink" },
    { text: "채팅할 준비 됐나요?", position: "left", color: "orange" },
    { text: "대화를 시작해볼까요?", position: "right", color: "teal" },
    { text: "즐거운 대화해요!", position: "left", color: "indigo" },
    { text: "오늘 하루도 화이팅!", position: "right", color: "amber" },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      await login(username);
      setIsLoading(false);
      navigate("/rooms");
    } catch (err) {
      setError("로그인에 실패했습니다. 다시 시도해주세요.");
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 px-4 py-12 sm:px-6 lg:px-8">
      {/* 배경 장식 요소 - 메시지 버블 */}
      <div className="absolute inset-0 overflow-hidden opacity-20">
        {messageBubbles.map((bubble, index) => (
          <div
            key={index}
            className={`absolute animate-float select-none rounded-2xl p-4 shadow-lg ${
              bubble.position === "left"
                ? "left-[10%] bg-white/80 text-slate-700"
                : "right-[10%] bg-slate-700/80 text-white"
            }`}
            style={{
              top: `${(index * 12) % 100}%`,
              animationDelay: `${index * 0.5}s`,
              animationDuration: `${10 + index}s`,
            }}
          >
            {bubble.text}
          </div>
        ))}
      </div>

      {/* 메인 컨텐츠 */}
      <div className="relative w-full max-w-md">
        {/* 로고 및 앱 이름 */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white bg-opacity-10 backdrop-blur-md">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-12 w-12 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
          <h1 className="text-center text-3xl font-bold tracking-tight text-white">
            실시간 <span className="text-blue-400">채팅</span> 서비스
          </h1>
          <p className="mt-2 text-center text-sm text-slate-300">
            친구들과 대화를 시작하려면 사용자 이름을 입력하세요
          </p>
        </div>

        {/* 로그인 폼 */}
        <div className="overflow-hidden rounded-xl bg-white/10 p-8 shadow-2xl backdrop-blur-lg">
          <div>
            {error && (
              <div className="mb-4 rounded-md bg-rose-500/10 p-3 text-center text-sm text-rose-500">
                {error}
              </div>
            )}
          </div>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="username"
                  className="block text-sm font-medium text-white"
                >
                  사용자 이름
                </label>
                <div className="mt-1">
                  <input
                    id="username"
                    name="username"
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="block w-full appearance-none rounded-lg border border-slate-600/30 bg-white/10 px-4 py-3 text-white placeholder-slate-400 shadow-inner backdrop-blur-sm transition-colors focus:border-blue-400/50 focus:outline-none focus:ring-2 focus:ring-blue-400/20"
                    placeholder="닉네임을 입력하세요"
                  />
                </div>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="group relative flex w-full justify-center rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-3 text-sm font-medium text-white shadow-lg transition-all hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-70"
              >
                {isLoading ? (
                  <span className="flex items-center">
                    <svg
                      className="mr-2 h-4 w-4 animate-spin"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    로그인 중...
                  </span>
                ) : (
                  "대화 시작하기"
                )}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <p className="text-center text-xs text-slate-400">
              * 별도의 회원가입 없이 닉네임만으로 시작할 수 있습니다
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// 애니메이션 스타일 추가
const style = document.createElement("style");
style.textContent = `
  @keyframes float {
    0% {
      transform: translateY(0) translateX(0);
      opacity: 0;
    }
    10% {
      opacity: 0.3;
    }
    50% {
      transform: translateY(-30vh) translateX(10vw);
    }
    90% {
      opacity: 0.2;
    }
    100% {
      transform: translateY(-80vh) translateX(5vw);
      opacity: 0;
    }
  }
  .animate-float {
    animation: float linear forwards;
  }
`;
document.head.appendChild(style);

export default JoinPage;
