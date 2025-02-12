/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
//@ts-nocheck
import { Button } from "@/components/ui/button";
import { useState } from "react";

function SessionStopped({ startSession }: { startSession: any }) {
  const [isActivating, setIsActivating] = useState(false);

  function handleStartSession() {
    if (isActivating) return;

    setIsActivating(true);
    startSession();
  }

  return (
    <div className="flex h-full w-full items-center justify-center">
      <Button
        onClick={handleStartSession}
        className={isActivating ? "bg-gray-600" : "bg-red-600"}
      >
        {isActivating ? "starting session..." : "start session"}
      </Button>
    </div>
  );
}

function SessionActive({
  stopSession,
  sendTextMessage,
  askRandomQuestion,
}: {
  stopSession: any;
  sendTextMessage: any;
  askRandomQuestion: any;
}) {
  const [message, setMessage] = useState("");

  function handleSendClientEvent() {
    sendTextMessage(message);
    setMessage("");
  }

  return (
    <div className="flex h-full w-full items-center justify-center gap-4">
      {/* Existing input + send button */}
      <input
        onKeyDown={(e) => {
          if (e.key === "Enter" && message.trim()) {
            handleSendClientEvent();
          }
        }}
        type="text"
        placeholder="send a text message..."
        className="flex-1 rounded-full border border-gray-200 p-4"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <Button
        onClick={() => {
          if (message.trim()) {
            handleSendClientEvent();
          }
        }}
        className="bg-blue-400"
      >
        send text
      </Button>

      {/* Random Question Button */}
      <Button onClick={askRandomQuestion} className="bg-green-400">
        Ask Random Question
      </Button>

      <Button onClick={stopSession}>disconnect</Button>
    </div>
  );
}

// Then ensure "askRandomQuestion" is destructured:
export default function SessionControls({
  startSession,
  stopSession,
  sendClientEvent,
  sendTextMessage,
  serverEvents,
  isSessionActive,
  askRandomQuestion,
}: {
  startSession: any;
  stopSession: any;
  sendClientEvent: any;
  sendTextMessage: any;
  serverEvents: any;
  isSessionActive: any;
  askRandomQuestion: any;
}) {
  return (
    <div className="flex h-full gap-4 rounded-md border-t-2 border-gray-200">
      {isSessionActive ? (
        <SessionActive
          stopSession={stopSession}
          sendClientEvent={sendClientEvent}
          sendTextMessage={sendTextMessage}
          askRandomQuestion={askRandomQuestion}
          serverEvents={serverEvents}
        />
      ) : (
        <SessionStopped startSession={startSession} />
      )}
    </div>
  );
}
