import React, { useRef, useEffect } from "react";
import moment from "moment";

const MessageList = ({ messages }) => {
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col flex-1 overflow-y-auto p-4">
      {messages.map((msg, index) => (
        <div
          key={index}
          className={`mb-4 ${
            msg.type === "notice" ? "text-center" : "flex flex-col"
          }`}
        >
          {msg.type === "notice" ? (
            <span className="py-2 px-3 bg-gray-100 rounded-lg inline-block text-sm text-gray-700">
              {msg.text}
            </span>
          ) : (
            <>
              <div className="flex items-baseline mb-1">
                <span className="font-bold text-indigo-600">
                  {msg.username || "알 수 없음"}
                </span>
                <span className="text-xs text-gray-500 ml-2">
                  {msg.createdAt ? moment(msg.createdAt).format("HH:mm") : ""}
                </span>
              </div>
              <div className="bg-white p-3 rounded-lg shadow-sm">
                {msg.text}
              </div>
            </>
          )}
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;
