import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import api from "../../api";
import { API_ENDPOINTS } from "../../constants";
import { setStage, setPages } from "../../store/slices/projectSlice";
import { setCurrentChatId } from "../../store/slices/chatSlice";
import StageInfo from "./StageInfo";
import DevelopmentPagesList from "./DevelopmentPagesList";
import ColorPickerInput from "./ColorPickerInput";
import SketchCanvas from "./SketchCanvas";
import PreviewImages from "./PreviewImages";

let socket;

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const currentChatId = useSelector((state) => state.chat.currentChatId);
  const pages = useSelector((state) => state.project.pages);
  const [selectedFile, setSelectedFile] = useState(null);
  const dispatch = useDispatch();

  const location = useLocation();
  const initialMessage = location.state?.initialMessage;
  const [showPreviewImages, setShowPreviewImages] = useState(false);
  const [images, setImages] = useState([]);

  useEffect(() => {
    const initializeChat = async () => {
      try {
        const savedChatId = localStorage.getItem("currentChatId");

        if (savedChatId) {
          dispatch(setCurrentChatId(savedChatId));
          const response = await api.get(API_ENDPOINTS.MESSAGES(savedChatId));
          setMessages(
            response.data.map((msg) => ({
              text: msg.content,
              isUser: msg.sender !== "assistant",
            })),
          );
          setupWebSocket(savedChatId);
        } else {
          createNewChat();
        }
      } catch (err) {
        console.error("Chat init error:", err);
        setError("Unable to connect to chat.");
        setMessages([{ text: "Hello! How can I assist you today?", isUser: false }]);
      }
    };

    const createNewChat = async () => {
      try {
        const response = await api.post(API_ENDPOINTS.CHATS, {
          title: `Chat ${new Date().toLocaleString()}`,
        });

        dispatch(setCurrentChatId(response.data.id));
        localStorage.setItem("currentChatId", response.data.id);
        setMessages([{ text: "Hello! How can I assist you today?", isUser: false }]);

        await api.post(API_ENDPOINTS.MESSAGES(response.data.id), {
          content: "Hello! How can I assist you today?",
          sender: "assistant",
        });

        setupWebSocket(response.data.id);
      } catch (err) {
        console.error("New chat creation failed:", err);
        setError("Could not create a new chat.");
      }
    };

    initializeChat();
    return () => {
      if (socket) socket.close();
    };
  }, []);

  // 👇 Establish websocket connection
  const setupWebSocket = (chatId) => {
    const token = localStorage.getItem("access");
    const wsUrl = `ws://127.0.0.1:8000/ws/chat/${chatId}/?token=${token}`;
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log("WebSocket connected");
      if (initialMessage) {
        handleSend(initialMessage);
        window.history.replaceState({}, document.title);
      }
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("WS Message", data);
      const extra_details = data.extra_details || {};

      const newMessage = {
        text: data.response,
        isUser: false,
        isSeekingApproval: data.is_seeking_approval,
        ...(extra_details?.ui_flags?.show_development_pages_preview && {
          specialComponent: "developmentPagesList",
        }),
        ...(extra_details?.ui_flags?.show_color_picker && {
          specialComponent: "colorPicker",
        }),
        ...(extra_details?.ui_flags?.show_preview_images && {
          specialComponent: "previewImages",
        }),
      };
      if (extra_details?.stage_data?.pages) {
        dispatch(setPages(extra_details.stage_data.pages));
      }
      if (extra_details?.stage_data?.images) {
        setImages(extra_details.stage_data.images);
      }

      setMessages((prev) => [...prev.filter((msg) => !msg.isLoading), newMessage]);

      setIsLoading(false);
      if (data.project_stage) {
        dispatch(setStage(data.project_stage));
      }
    };

    socket.onerror = (err) => {
      console.error("WebSocket error", err);
      setError("WebSocket error");
    };

    socket.onclose = () => {
      console.log("WebSocket closed");
    };
  };

  const handleSend = async (text) => {
    if (!text.trim()) return;
    setMessages((prev) => [...prev, { text, isUser: true }]);
    setMessages((prev) => prev.map((msg) => ({ ...msg, isSeekingApproval: false })));
    setIsLoading(true);

    setMessages((prev) => [...prev, { text: "Thinking...", isUser: false, isLoading: true }]);

    const response = await api.post(API_ENDPOINTS.MESSAGES(currentChatId), {
      content: text,
      sender: "user",
    });

    // Send message over WebSocket
    socket.send(JSON.stringify({ content: text }));
  };

  const handleChoice = async (choiceText) => {
    if (!choiceText.trim()) return;
    setMessages((prev) => prev.map((msg) => ({ ...msg, isSeekingApproval: false })));
    setMessages((prev) => [...prev, { text: choiceText, isUser: true }]);
    setIsLoading(true);

    await api.post(API_ENDPOINTS.MESSAGES(currentChatId), {
      content: choiceText,
      sender: "user",
    });

    setMessages((prev) => [...prev, { text: "Thinking...", isUser: false, isLoading: true }]);

    // Send choice over WebSocket
    socket.send(JSON.stringify({ content: choiceText }));
  };

  const handleColorSelect = async (colorData) => {
    const colorText = `Selected color: ${colorData.hex}`;

    setMessages((prev) => [
      ...prev,
      {
        text: colorText,
        isUser: true,
        colorData: colorData, // Store color data for visual representation
      },
    ]);

    setMessages((prev) => prev.map((msg) => ({ ...msg, isSeekingApproval: false })));
    setIsLoading(true);

    await api.post(API_ENDPOINTS.MESSAGES(currentChatId), {
      content: colorText,
      sender: "user",
    });

    setMessages((prev) => [...prev, { text: "Thinking...", isUser: false, isLoading: true }]);

    // Send color selection over WebSocket
    socket.send(
      JSON.stringify({
        content: colorText,
        color_data: colorData, // Send structured color data
      }),
    );
  };

  const handleAddDesign = (fileName) => {
    setSelectedFile(fileName);
    setShowCanvas(true);
  };

  const [showCanvas, setShowCanvas] = useState(false);

  return (
    <div className="flex flex-col h-full bg-gray-100 mx-auto">
      <div className="flex justify-center items-center p-2 bg-white border-b border-gray-300">
        <div className="font-medium">Project {currentChatId ? `#${currentChatId}` : ""}</div>
      </div>
      {error && (
        <div className="bg-red-100 p-2 text-red-700 text-sm">
          {error}
          <button className="ml-2 text-red-500" onClick={() => setError(null)}>
            ✕
          </button>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((msg, index) => (
          <div key={index}>
            {msg.specialComponent === "developmentPagesList" && (
              <DevelopmentPagesList
                pages={pages || []}
                onAddDesign={handleAddDesign}
                onEditDetails={() => { }}
              />
            )}
            {msg.text && (
              <ChatMessage
                text={msg.text}
                isUser={msg.isUser}
                isLoading={msg.isLoading}
                is_choice={msg.isSeekingApproval}
                onChoiceSelect={handleChoice}
              />
            )}
            {msg.specialComponent === "colorPicker" && (
              <ColorPickerInput
                onColorSelect={handleColorSelect}
                onTextSend={handleSend}
                disabled={isLoading}
              />
            )}
            {msg.specialComponent === "previewImages" && (
              <button className="p-2 bg-blue-500 text-white rounded" onClick={() => setShowPreviewImages(true)}>Preview Images</button>
            )}
          </div>
        ))}
        {showPreviewImages && (
          <PreviewImages
            isOpen={showPreviewImages}
            onClose={() => setShowPreviewImages(false)}
            images={images}
          />
        )}

        <div ref={messagesEndRef} />
      </div>
      {showCanvas && (
        <SketchCanvas
          open={showCanvas}
          onClose={() => {
            setShowCanvas(false);
          }}
          fileName={selectedFile}
        />
      )}
      <StageInfo />
      <ChatInput onSend={handleSend} disabled={isLoading} />
    </div>
  );
};

export default Chat;
