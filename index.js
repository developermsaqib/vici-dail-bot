const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
  maxHttpBufferSize: 1e8, // Increase buffer size for audio chunks
});

// Enable CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

io.on("connection", (socket) => {
  console.log("👤 Client connected:", socket.id);

  socket.on("callInitiated", (data) => {
    console.log("📞 Call initiated:", data);
    io.emit("callStatus", {
      type: "initiated",
      data: data,
    });
  });

  socket.on("callAnswered", (data) => {
    console.log(`
=================================
📞 Call Answered!
🔌 Socket ID: ${socket.id}
⏰ Time: ${data.timestamp}
📊 Connection Details:
   - Socket Connected: ${!!socket.connected}
   - Call Active: ${data.connectionDetails.callActive}
   - Connection Established: ${data.connectionDetails.established}
=================================
    `);

    io.emit("callStatus", {
      type: "answered",
      data: data,
    });
  });

  socket.on("callError", (error) => {
    console.error("Call error:", error);
    io.emit("callStatus", {
      type: "error",
      error: error,
    });
  });

  socket.on("audioChunk", (data) => {
    console.log("🎵 Received audio chunk, timestamp:", data.timestamp);
    socket.broadcast.emit("incomingAudio", data.chunk);
  });

  socket.on("audioComplete", () => {
    console.log("✅ Audio playback completed");
    io.emit("callStatus", { type: "audioComplete" });
  });

  socket.on("callAnsweredWithConnection", () => {
    console.log("📞 Call answered and ready for WebSocket communication");

    // Trigger WebSocket connection establishment on the client-side
    socket.emit("establishWebSocketConnection", {
      websocketServerUrl: "ws://localhost:8081", // Replace with your actual WebSocket server URL
    });
  });

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });
});

// Start server
const PORT = 8089;
http.listen(PORT, "0.0.0.0", () => {
  console.log(`Socket.IO server running on port ${PORT}`);
});

// Initialize dialer
const { Dialer } = require("./makeCall.js");
const dialer = new Dialer();

// Complete call sequence with proper timing
setTimeout(async () => {
  try {
    // Step 1: Make the call
    console.log("Initiating call...");
    const callResponse = await dialer.makeCall();
    console.log("Call initiated, waiting for answer...");

    // Add call answer detection
    if (
      callResponse &&
      callResponse.data &&
      callResponse.data.includes("INCALL")
    ) {
      io.emit("callStatus", {
        type: "answered",
        data: callResponse.data,
      });
      console.log("Call has been answered");
    }

    // Wait before hangup
    setTimeout(async () => {
      try {
        console.log("Executing hangup...");
        await dialer.hangupCall();
        console.log("Call hung up, waiting 10 seconds before disposition...");

        // Step 3: Wait and then mark disposition
        setTimeout(async () => {
          try {
            console.log("Marking disposition...");
            await dialer.markDisposition();
            console.log("Call sequence completed");
          } catch (error) {
            console.error("Error marking disposition:", error);
          }
        }, 10000); // Wait 10 seconds before disposition
      } catch (error) {
        console.error("Error hanging up call:", error);
      }
    }, 20000); // Wait 20 seconds before hangup
  } catch (error) {
    console.error("Error making call:", error);
  }
}, 2000); // Wait 2 seconds before starting
