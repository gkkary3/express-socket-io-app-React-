import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { SocketProvider } from "./contexts/SocketContext";
import { AuthProvider } from "./contexts/AuthContext";
import JoinPage from "./pages/JoinPage";
import ChatPage from "./pages/ChatPage";
import RoomListPage from "./pages/RoomListPage";

function App() {
  return (
    <Router>
      <SocketProvider>
        <AuthProvider>
          <div className="min-h-screen">
            <Routes>
              <Route path="/" element={<JoinPage />} />
              <Route path="/rooms" element={<RoomListPage />} />
              <Route path="/chat" element={<ChatPage />} />
            </Routes>
          </div>
        </AuthProvider>
      </SocketProvider>
    </Router>
  );
}

export default App;
