
import React, { useState, useEffect, useCallback, useRef } from "react";
import io from "socket.io-client";

export function DoctorChat({ userData, socket }) {
  console.log("[DoctorChat] Rendering with userData:", {
    userId: userData?._id,
    role: userData?.role,
  });
  const [availableUsers, setAvailableUsers] = useState([]);
  const [selectedChatGroupId, setSelectedChatGroupId] = useState(null);
  const [selectedRecipientId, setSelectedRecipientId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);
  const socketInitialized = useRef(false);
  const fileInputRef = useRef(null);

  // Fetch available users (patients for doctors)
  const fetchAvailableUsers = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Authentication required. Please log in again.");
        console.error("[fetchAvailableUsers] No token found");
        return;
      }
      const apiUrl = `${import.meta.env.VITE_API_URL}/api/messages/available-users`;
      console.log("[fetchAvailableUsers] Fetching:", apiUrl);
      const response = await fetch(apiUrl, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || `Failed to fetch users (Status: ${response.status})`);
        console.error("[fetchAvailableUsers] Error:", errorData);
        return;
      }
      const data = await response.json();
      console.log("[fetchAvailableUsers] Fetched users:", data);
      setAvailableUsers(data);
      setError("");
    } catch (err) {
      console.error("[fetchAvailableUsers] Error:", err);
      setError("Failed to connect to server. Please try again.");
    }
  }, []);

  // Fetch messages for a chat group
  const fetchMessages = useCallback(async (chatGroupId) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Authentication required. Please log in again.");
        console.error("[fetchMessages] No token found");
        return;
      }
      const apiUrl = `${import.meta.env.VITE_API_URL}/api/messages?chatGroupId=${chatGroupId}`;
      console.log("[fetchMessages] Fetching:", apiUrl);
      const response = await fetch(apiUrl, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || "Failed to fetch messages");
        console.error("[fetchMessages] Error:", errorData);
        return;
      }
      const data = await response.json();
      console.log("[fetchMessages] Fetched messages:", data.length);
      setMessages(data);
      setError("");
    } catch (err) {
      console.error("[fetchMessages] Error:", err);
      setError("Failed to connect to server. Please try again.");
    }
  }, []);

  // Create or fetch chat group
  const createChatGroup = useCallback(async (recipientId) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Authentication required. Please log in again.");
        console.error("[createChatGroup] No token found");
        return null;
      }
      const apiUrl = `${import.meta.env.VITE_API_URL}/api/messages/create-chat-group`;
      console.log("[createChatGroup] Posting to:", apiUrl, "recipientId:", recipientId);
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recipientId }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || "Failed to create chat group");
        console.error("[createChatGroup] Error:", errorData);
        return null;
      }
      const data = await response.json();
      console.log("[createChatGroup] Created/Fetched chat group:", data.chatGroupId);
      return data.chatGroupId;
    } catch (err) {
      console.error("[createChatGroup] Error:", err);
      setError("Failed to connect to server. Please try again.");
      return null;
    }
  }, []);

  // Handle user selection
  const handleUserSelect = useCallback(
    async (user) => {
      console.log("[handleUserSelect] Selected user:", {
        userId: user._id,
        chatGroupId: user.chatGroupId,
      });
      setSelectedRecipientId(user._id);
      setError("");
      if (user.chatGroupId) {
        setSelectedChatGroupId(user.chatGroupId);
      } else {
        const chatGroupId = await createChatGroup(user._id);
        if (chatGroupId) {
          setSelectedChatGroupId(chatGroupId);
          setAvailableUsers((prev) =>
            prev.map((u) =>
              u._id === user._id ? { ...u, chatGroupId, lastMessage: null } : u
            )
          );
        } else {
          setSelectedChatGroupId(null);
          setError("Failed to initialize chat. Please try again.");
        }
      }
    },
    [createChatGroup]
  );

  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (["image/jpeg", "image/png", "application/pdf"].includes(file.type)) {
        setSelectedFile(file);
        if (file.type.startsWith("image/")) {
          setPreviewUrl(URL.createObjectURL(file));
        } else {
          setPreviewUrl(null);
        }
        setError("");
      } else {
        setError("Only JPEG, PNG, and PDF files are allowed");
        setSelectedFile(null);
        setPreviewUrl(null);
      }
    }
  };

  // Remove selected file
  const removeFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Send message
  const sendMessage = useCallback(
    async (e) => {
      e.preventDefault();
      if (isSending) {
        console.log("[sendMessage] Already sending, ignoring");
        return;
      }
      console.log("[sendMessage] Attempting to send:", {
        chatGroupId: selectedChatGroupId,
        recipientId: selectedRecipientId,
        content: newMessage,
        file: selectedFile ? selectedFile.name : "No file",
      });

      if (!newMessage.trim() && !selectedFile) {
        setError("Please enter a message or attach a file");
        console.log("[sendMessage] No message or file provided");
        return;
      }

      if (!selectedRecipientId || !selectedChatGroupId) {
        setError("Please select a patient and initialize the chat");
        console.log("[sendMessage] Validation failed:", {
          recipientId: selectedRecipientId,
          chatGroupId: selectedChatGroupId,
        });
        return;
      }

      try {
        setIsSending(true);
        const token = localStorage.getItem("token");
        if (!token) {
          setError("Authentication required. Please log in again.");
          console.error("[sendMessage] No token found");
          return;
        }

        const formData = new FormData();
        formData.append("recipientId", selectedRecipientId);
        formData.append("content", newMessage);
        formData.append("chatGroupId", selectedChatGroupId);
        if (selectedFile) {
          formData.append("attachment", selectedFile);
        }

        const apiUrl = `${import.meta.env.VITE_API_URL}/api/messages`;
        console.log("[sendMessage] Posting to:", apiUrl);
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          setError(errorData.error || "Failed to send message. Please try again.");
          console.error("[sendMessage] Error:", errorData);
          return;
        }

        const data = await response.json();
        console.log("[sendMessage] Message sent:", data);

        if (!data._id || !data.chatGroupId) {
          setError("Invalid message data received from server");
          console.error("[sendMessage] Invalid message data:", data);
          return;
        }

        setMessages((prev) => {
          if (!prev.some((msg) => String(msg._id) === String(data._id))) {
            return [...prev, data];
          }
          return prev;
        });
        setNewMessage("");
        setSelectedFile(null);
        setPreviewUrl(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        setError("");
      } catch (err) {
        console.error("[sendMessage] Error:", err);
        setError(`Failed to send message: ${err.message}`);
      } finally {
        setIsSending(false);
      }
    },
    [isSending, selectedChatGroupId, selectedRecipientId, newMessage, selectedFile]
  );

  // Retry mechanism for failed sends
  const retrySendMessage = useCallback(() => {
    if (isSending) return;
    setError("");
    sendMessage({ preventDefault: () => {} });
  }, [isSending, sendMessage]);

  // Scroll to latest message
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Truncate last message for preview
  const truncateMessage = (content, attachment, maxLength = 30) => {
    console.log("[truncateMessage] Processing:", { content, attachment });
    if (attachment && attachment.fileType?.startsWith("image/")) {
      return "Photo";
    }
    if (attachment && attachment.fileName) {
      return attachment.fileName.length > maxLength
        ? `${attachment.fileName.slice(0, maxLength)}...`
        : attachment.fileName;
    }
    return content && content.length > maxLength
      ? `${content.slice(0, maxLength)}...`
      : content || "No messages yet";
  };

  // Render attachment
  const renderAttachment = (attachment) => {
    if (!attachment) return null;
    const { url, fileType, fileName } = attachment;
    const fullUrl = `${import.meta.env.VITE_API_URL}${url}`;
    if (fileType?.startsWith("image/")) {
      return (
        <a href={fullUrl} target="_blank" rel="noopener noreferrer">
          <img
            src={fullUrl}
            alt={fileName}
            className="max-w-[200px] h-auto rounded-md mt-2 shadow-sm hover:opacity-90 transition-opacity"
          />
        </a>
      );
    } else if (fileType === "application/pdf") {
      return (
        <a
          href={fullUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:text-blue-700 underline mt-2 block text-sm"
        >
          {fileName}
        </a>
      );
    }
    return null;
  };

  // Socket.IO setup
  useEffect(() => {
    if (!socket || socketInitialized.current || !userData?._id) {
      console.log("[useEffect] Skipping Socket.IO setup", {
        socket: !!socket,
        socketInitialized: socketInitialized.current,
        userId: userData?._id,
      });
      return;
    }
    socketInitialized.current = true;

    console.log("[useEffect] Setting up Socket.IO with userId:", userData._id);
    socket.on("connect", () => {
      console.log("[Socket.IO] Connected");
      socket.emit("join", String(userData._id));
    });

    socket.on("receiveMessage", (message) => {
      console.log("[Socket.IO] Received message:", message);
      if (!message.chatGroupId || !message._id) {
        console.error("[Socket.IO] Invalid message:", message);
        return;
      }
      if (String(message.chatGroupId) === String(selectedChatGroupId)) {
        setMessages((prev) => {
          if (!prev.some((msg) => String(msg._id) === String(message._id))) {
            return [...prev, message];
          }
          return prev;
        });
      }
    });

    socket.on("chatGroupUpdate", (updatedChatGroup) => {
      console.log("[Socket.IO] Chat group update:", updatedChatGroup);
      if (!updatedChatGroup._id || !updatedChatGroup.participants) {
        console.error("[Socket.IO] Invalid chat group update:", updatedChatGroup);
        return;
      }
      setAvailableUsers((prev) =>
        prev.map((user) =>
          updatedChatGroup.participants.includes(user._id)
            ? {
                ...user,
                chatGroupId: updatedChatGroup._id,
                lastMessage: updatedChatGroup.lastMessage || null,
              }
            : user
        )
      );
    });

    socket.on("error", (err) => {
      console.error("[Socket.IO] Error:", err);
      setError(`Socket error: ${err.message || err}`);
    });

    socket.on("connect_error", (err) => {
      console.error("[Socket.IO] Connection error:", err);
      setError(`Socket connection failed: ${err.message}`);
    });

    socket.on("disconnect", (reason) => {
      console.log("[Socket.IO] Disconnected:", reason);
      setError(`Socket disconnected: ${reason}`);
    });

    socket.connect();

    return () => {
      console.log("[useEffect] Cleaning up Socket.IO");
      socket.off("connect");
      socket.off("receiveMessage");
      socket.off("chatGroupUpdate");
      socket.off("error");
      socket.off("connect_error");
      socket.off("disconnect");
      socket.disconnect();
      socketInitialized.current = false;
    };
  }, [socket, userData?._id, selectedChatGroupId]);

  // Clean up preview URL
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Fetch available users on mount
  useEffect(() => {
    fetchAvailableUsers();
  }, [fetchAvailableUsers]);

  // Fetch messages when chat group changes
  useEffect(() => {
    if (selectedChatGroupId) {
      console.log("[useEffect] Fetching messages for chatGroupId:", selectedChatGroupId);
      setMessages([]);
      fetchMessages(selectedChatGroupId);
    } else {
      setMessages([]);
    }
  }, [selectedChatGroupId, fetchMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-gray-100 rounded-xl shadow-2xl overflow-hidden">
      <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <h2 className="text-2xl font-bold">Patients</h2>
        </div>
        {error && (
          <div className="p-4 bg-red-100 text-red-700 rounded-lg mx-4 my-2 animate-pulse">
            {error}
            {error.includes("Failed to send message") && (
              <button
                onClick={retrySendMessage}
                className="ml-2 text-blue-700 underline hover:text-blue-900"
                disabled={isSending}
              >
                Retry
              </button>
            )}
          </div>
        )}
        {availableUsers.length === 0 ? (
          <div className="p-6 text-gray-500 text-center">
            <p className="font-medium">No patients available</p>
            <p className="text-sm mt-1">No patients found in the system.</p>
          </div>
        ) : (
          <ul className="flex-1 overflow-y-auto p-4 space-y-3">
            {availableUsers.map((user) => (
              <li
                key={user._id}
                onClick={() => handleUserSelect(user)}
                className={`p-4 rounded-lg cursor-pointer flex items-center space-x-4 transition-all duration-200 ${
                  selectedRecipientId === user._id ? "bg-blue-50 text-blue-800 shadow-md" : "hover:bg-gray-50"
                }`}
              >
                <img
                  src={
                    user.profilePicture
                      ? `${import.meta.env.VITE_API_URL}${user.profilePicture}`
                      : "/default-avatar.png"
                  }
                  alt={user.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-gray-200"
                />
                <div className="flex-1">
                  <p className="font-semibold text-gray-800">{user.name}</p>
                  <p className="text-sm text-gray-500 truncate flex items-center">
                    {user.lastMessage ? (
                      <>
                        {String(user.lastMessage.senderId) === String(userData._id) && "You: "}
                        {user.lastMessage.attachment?.fileType?.startsWith("image/") && (
                          <svg
                            className="w-4 h-4 mr-1 text-gray-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                        )}
                        {truncateMessage(user.lastMessage.content, user.lastMessage.attachment)}
                      </>
                    ) : (
                      "No messages yet"
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="w-2/3 flex flex-col bg-white">
        {selectedRecipientId && selectedChatGroupId ? (
          <>
            <div className="p-6 border-b border-gray-200 bg-gray-50">
              <h2 className="text-xl font-semibold text-gray-800">
                {availableUsers.find((u) => u._id === selectedRecipientId)?.name || "Chat"}
              </h2>
            </div>
            <div className="flex-1 p-6 overflow-y-auto bg-gray-50">
              {messages.length === 0 ? (
                <p className="text-gray-500 text-center mt-10">No messages yet</p>
              ) : (
                messages.map((message) => (
                  <div
                    key={message._id}
                    className={`mb-4 flex ${
                      String(message.senderId) === String(userData._id) ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-md p-4 rounded-xl shadow-sm ${
                        String(message.senderId) === String(userData._id)
                          ? "bg-blue-600 text-white"
                          : "bg-gray-200 text-gray-800"
                      }`}
                    >
                      {message.content && <p className="text-sm">{message.content}</p>}
                      {renderAttachment(message.attachment)}
                      <p className="text-xs mt-2 opacity-70">
                        {new Date(message.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={sendMessage} className="p-4 border-t border-gray-200 bg-white">
              {selectedFile && (
                <div className="mb-3 p-3 bg-gray-100 rounded-lg flex items-center justify-between">
                  {previewUrl ? (
                    <img src={previewUrl} alt="Preview" className="max-w-[100px] h-auto rounded-md" />
                  ) : (
                    <span className="text-sm text-gray-700">{selectedFile.name}</span>
                  )}
                  <button
                    type="button"
                    onClick={removeFile}
                    className="text-red-500 hover:text-red-700"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
              <div className="flex items-center space-x-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  disabled={isSending}
                />
                <label className="relative">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,application/pdf"
                    onChange={handleFileChange}
                    ref={fileInputRef}
                    className="absolute opacity-0 w-0 h-0"
                    disabled={isSending}
                  />
                  <span className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 cursor-pointer">
                    <svg
                      className="w-5 h-5 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        stroke="http://www.w3.org/2000/svg"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M15.172 7l-6.586 6.586a2 2 0 002.828 2.828l6.586-6.586M19 3h-2.586l-1.414-1.414A2 2 0 0013.172 1H10.828a2 2 0 00-1.414.586L7 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 0 00-2-2z"
                      ></path>
                    </svg>
                    Attach
                  </span>
                </label>
                <button
                  type="submit"
                  className={`px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all ${
                    isSending ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                  disabled={isSending}
                >
                  {isSending ? "Sending..." : "Send"}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <p className="text-gray-500 text-lg">Select a patient to start chatting</p>
          </div>
        )}
      </div>
    </div>
  );
}
