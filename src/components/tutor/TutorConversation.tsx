import React, { useState, useRef, useEffect } from "react";
import { TutorMessage, WorkMode, CostMode } from "../../types";
import WorkModeSelector from "../workModes/WorkModeSelector";
import CostModeSelector from "../costModes/CostModeSelector";
import { getMockTutorResponse } from "../../lib/tutor";

interface TutorConversationProps {
  initialMessages: TutorMessage[];
}

export default function TutorConversation({ initialMessages }: TutorConversationProps) {
  const [messages, setMessages] = useState<TutorMessage[]>(initialMessages);
  const [inputValue, setInputValue] = useState("");
  const [workMode, setWorkMode] = useState<WorkMode>("Learning");
  const [costMode, setCostMode] = useState<CostMode>("Normal Learning");
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userMsg: TutorMessage = {
      id: Date.now().toString(),
      role: "user",
      content: inputValue.trim()
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsTyping(true);

    try {
      const response = await getMockTutorResponse(userMsg.content, workMode, costMode);
      setMessages((prev) => [...prev, response.message]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between mb-2">
        <WorkModeSelector currentMode={workMode} onChange={setWorkMode} />
        <CostModeSelector currentMode={costMode} onChange={setCostMode} />
      </div>

      <div className="flex-1 overflow-y-auto mb-6 pr-2 space-y-6">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.role === "user" ? "items-start" : "items-end"}`}>
            <div
              className={`max-w-[80%] p-4 rounded-lg shadow-sm ${
                msg.role === "user"
                  ? "bg-[#dce9ff] text-[#041632] border border-[#b7c7eb] rounded-tr-none"
                  : "bg-white text-[#0b1c30] border border-[#c5c6ce] rounded-tl-none font-serif"
              }`}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>

              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-4 pt-3 border-t border-[#eaf1ff]">
                  <p className="text-xs text-[#75777e] font-sans font-semibold mb-1">מקורות:</p>
                  <ul className="space-y-1">
                    {msg.citations.map((cite) => (
                      <li key={cite.id} className="text-xs font-sans text-[#44474d] bg-[#f8f9ff] p-2 rounded">
                        &quot;{cite.referenceText}&quot; (מקור: {cite.sourceId})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex items-end text-[#75777e] text-sm animate-pulse">
            המורה מקליד...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="relative">
        <input
          type="text"
          placeholder="שאילתה (Inquiry)..."
          className="w-full bg-white border border-[#c5c6ce] rounded-lg px-4 py-4 pr-12 focus:outline-none focus:border-[#506354] shadow-sm"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          disabled={isTyping}
        />
        <button
          type="submit"
          disabled={isTyping || !inputValue.trim()}
          className="absolute left-3 top-1/2 -translate-y-1/2 bg-[#041632] text-white p-2 rounded-md hover:bg-[#1b2b48] disabled:opacity-50 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transform rotate-180"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
        </button>
      </form>
    </div>
  );
}
