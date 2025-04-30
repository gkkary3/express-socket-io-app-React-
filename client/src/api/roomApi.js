// 서버 API URL 설정
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:4000/api";

// 채팅방 삭제
export const deleteRoom = async (roomId, userId) => {
  try {
    const response = await fetch(`${API_URL}/rooms/${roomId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        message: "채팅방 삭제 중 오류가 발생했습니다.",
      }));
      throw errorData;
    }

    return await response.json();
  } catch (error) {
    throw error.message
      ? error
      : { message: "채팅방 삭제 중 오류가 발생했습니다." };
  }
};
