// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-nocheck
"use client";

import { useEffect, useRef, useState } from "react";
import EventLog from "./_components/event-log";
import SessionControls from "./_components/session-controls";
import ToolPanel from "./_components/tool-panel";

export default function Chat() {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [events, setEvents] = useState([]);
  const [dataChannel, setDataChannel] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const peerConnection = useRef(null);
  const audioElement = useRef(null);

  // Define the list of questions for the conversation.
  const questions = [
    "What is your name?",
    "What is your email address?",
    "What is your company name?",
  ];

  async function startSession() {
    // Get an ephemeral key from the Fastify server.
    const tokenResponse = await fetch("/api/token");
    const data = await tokenResponse.json();
    const EPHEMERAL_KEY = data.client_secret.value;

    // Create a peer connection.
    const pc = new RTCPeerConnection();

    // Set up to play remote audio from the model.
    audioElement.current = document.createElement("audio");
    audioElement.current.autoplay = true;
    pc.ontrack = (e) => (audioElement.current.srcObject = e.streams[0]);

    // Add local audio track for microphone input in the browser.
    const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
    pc.addTrack(ms.getTracks()[0]);

    // Set up data channel for sending and receiving events.
    const dc = pc.createDataChannel("oai-events");
    setDataChannel(dc);

    // When the data channel opens, send the initial instructions and start the Q&A flow.
    dc.addEventListener("open", () => {
      console.log("Data channel opened");
      console.log("Sending initial instructions");
      const initialEvent = {
        type: "response.create",
        response: {
          conversation: "none",
          input: [],
          instructions: `
            You are an AI assistant that:
            1. Communicates exclusively in English.
            2. Is precise and direct in your responses.
            3. Maintains a professional yet friendly tone.
            4. Always ask only the specified question (and nothing else).
            5. Even if the user replies in another language or asks a question,
               ignore it and ask the specified question again in English.
          `,
        },
      };
      dc.send(JSON.stringify(initialEvent));
      // Start the Q&A flow by asking the first question.
      askCurrentQuestion(dc);
    });

    // Start the session using the Session Description Protocol (SDP).
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const baseUrl = "https://api.openai.com/v1/realtime";
    const model = "gpt-4o-mini-realtime-preview";
    const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
      method: "POST",
      body: offer.sdp,
      headers: {
        Authorization: `Bearer ${EPHEMERAL_KEY}`,
        "Content-Type": "application/sdp",
      },
    });

    const answer = {
      type: "answer",
      sdp: await sdpResponse.text(),
    };
    await pc.setRemoteDescription(answer);

    peerConnection.current = pc;
  }

  // This function sends the current question (or a farewell if done) via the data channel.
  function askCurrentQuestion(dc = dataChannel) {
    if (!dc) {
      console.error("No data channel available");
      return;
    }

    // Check that the data channel is open before attempting to send.
    if (dc.readyState !== "open") {
      console.warn(
        "Data channel is not open. Current readyState:",
        dc.readyState
      );
      return;
    }

    if (currentQuestionIndex < questions.length) {
      const currentQuestion = questions[currentQuestionIndex];
      const event = {
        type: "response.create",
        response: {
          conversation: "none",
          input: [],
          instructions: `
            You are an AI assistant that asks only the following question:
            "${currentQuestion}"
            Do not add any commentary or ask any other questions.
            The user is expected to provide only an answer.
            If the user does not answer directly (or responds in a language other than English),
            ignore the input and ask the question again in English.
          `,
        },
      };
      dc.send(JSON.stringify(event));
    } else {
      // All questions have been asked – send a farewell message and close the session.
      const farewellEvent = {
        type: "response.create",
        response: {
          conversation: "none",
          input: [],
          instructions: `Thank you for your time and bye.`,
        },
      };
      // Only send if the channel is still open.
      if (dc.readyState === "open") {
        dc.send(JSON.stringify(farewellEvent));
      } else {
        console.warn(
          "Data channel closed before farewell message could be sent."
        );
      }
      stopSession();
    }
  }

  // Stop the current session and clean up the connection.
  function stopSession() {
    if (dataChannel) {
      dataChannel.close();
    }
    if (peerConnection.current) {
      peerConnection.current.close();
    }

    setIsSessionActive(false);
    setDataChannel(null);
    peerConnection.current = null;
  }

  // Send a message to the model for non-user events.
  function sendClientEvent(message) {
    if (dataChannel && dataChannel.readyState === "open") {
      message.event_id = message.event_id || crypto.randomUUID();
      dataChannel.send(JSON.stringify(message));
      setEvents((prev) => [message, ...prev]);
    } else {
      console.error(
        "Failed to send message - data channel is not open",
        message
      );
    }
  }

  // This function handles the user's text message.
  // It sends the user's answer and then advances the Q&A flow by asking the next question.
  function sendTextMessage(message) {
    // Send the user's answer as a conversation item.
    const userEvent = {
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: message,
          },
        ],
      },
    };
    sendClientEvent(userEvent);

    // Advance the conversation by incrementing the question index.
    setCurrentQuestionIndex((prevIndex) => {
      const newIndex = prevIndex + 1;
      // Use a timeout to ensure the state updates before asking the next question.
      setTimeout(() => {
        askCurrentQuestion();
      }, 0);
      return newIndex;
    });
  }

  // Attach event listeners to the data channel when it is created.
  useEffect(() => {
    if (dataChannel) {
      // Append new server events to the events list.
      dataChannel.addEventListener("message", (e) => {
        setEvents((prev) => [JSON.parse(e.data), ...prev]);
      });

      // Mark the session as active when the data channel opens.
      dataChannel.addEventListener("open", () => {
        setIsSessionActive(true);
        setEvents([]);
      });
    }
  }, [dataChannel]);

  return (
    <main className="absolute bottom-0 left-0 right-0 top-16">
      <section className="absolute bottom-0 left-0 right-[380px] top-0 flex">
        <section className="absolute bottom-32 left-0 right-0 top-0 overflow-y-auto px-4">
          <EventLog events={events} />
        </section>
        <section className="absolute bottom-0 left-0 right-0 h-32 p-4">
          <SessionControls
            startSession={startSession}
            stopSession={stopSession}
            sendClientEvent={sendClientEvent}
            sendTextMessage={sendTextMessage}
            events={events}
            isSessionActive={isSessionActive}
          />
        </section>
      </section>
      <section className="absolute bottom-0 right-0 top-0 w-[380px] overflow-y-auto p-4 pt-0">
        <ToolPanel
          sendClientEvent={sendClientEvent}
          sendTextMessage={sendTextMessage}
          events={events}
          isSessionActive={isSessionActive}
        />
      </section>
    </main>
  );
}
