const axios = require("axios");
const io = require("socket.io-client");
const fs = require("fs");
const path = require("path");

class Dialer {
  constructor() {
    this.requestData = {
      server_ip: "116.202.84.211",
      session_name: "1737367644_800119824396",
      ACTION: "manDiaLnextCaLL",
      conf_exten: "8600053",
      user: "8001",
      pass: "tech159",
      campaign: "BOTSTEST",
      ext_context: "default",
      dial_timeout: "40",
      dial_prefix: "T4LCST",
      campaign_cid: "",
      preview: "NO",
      agent_log_id: "10003106",
      callback_id: "",
      lead_id: "",
      phone_code: "1",
      phone_number: "6783106090",
      list_id: "998",
      stage: "lookup",
      use_internal_dnc: "Y",
      use_campaign_dnc: "Y",
      omit_phone_code: "N",
      manual_dial_filter: "DNC_AND_CAMPDNC",
      manual_dial_search_filter: "NONE",
      vendor_lead_code: "",
      usegroupalias: "0",
      account: "",
      agent_dialed_number: "1",
      agent_dialed_type: "MANUAL_DIALNOW",
      vtiger_callback_id: "0",
      dial_method: "RATIO",
      manual_dial_call_time_check: "DISABLED",
      qm_extension: "8001",
      dial_ingroup: "",
      nocall_dial_flag: "DISABLED",
      cid_lock: "0",
      last_VDRP_stage: "PAUSED",
      routing_initiated_recording: "Y",
      exten: "8309",
      recording_filename: "FULLDATE_CUSTPHONE",
      channel: "Local/58600053@default",
      manual_dial_validation: "N",
      phone_login: "8001",
    };
    this.callData = {};

    // Initialize Socket.IO
    this.socket = io("http://localhost:8089", {
      transports: ["websocket"],
      reconnectionAttempts: 3,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    // Store call state
    this.callActive = false;
    this.audioStream = null;
    this.connectionEstablished = false;

    // Socket connection logging
    this.socket.on("connect", () => {
      console.log("🟢 Socket.IO Connected, ID:", this.socket.id);
    });

    this.socket.on("connect_error", (error) => {
      console.log("🔴 Socket.IO Connection Error:", error.message);
    });
  }

  // // New method to make call without socket
  // async makeCallWithoutSocket() {
  //   try {
  //     const data = new URLSearchParams(this.requestData).toString();
  //     let config = {
  //       method: "post",
  //       maxBodyLength: Infinity,
  //       url: "https://balitechcl1.dialerhosting.com/agc/vdc_db_query.php",
  //       headers: {
  //         "Content-Type": "application/x-www-form-urlencoded",
  //       },
  //       data: data,
  //     };

  //     const response = await axios.request(config);
  //     console.log("Call initiated:", response.data);

  //     // Parse and store call data
  //     if (typeof response.data === "string") {
  //       const [MDnextCID, lead_id, status, agent] = response.data.split("\n");
  //       this.callData = {
  //         MDnextCID,
  //         lead_id,
  //         agent_log_id: this.requestData.agent_log_id,
  //         call_id: MDnextCID,
  //       };
  //       console.log("Stored call data:", this.callData);
  //     }

  //     // Monitor call status without socket
  //     if (!response.data.includes("ERROR")) {
  //       this.monitorCallStatusWithoutSocket();
  //     }
  //   } catch (error) {
  //     console.error("Error making call:", error);
  //   }
  // }

  // // New method to monitor call without socket
  // async monitorCallStatusWithoutSocket() {
  //   const statusInterval = setInterval(async () => {
  //     try {
  //       const statusData = new URLSearchParams({
  //         server_ip: "116.202.84.211",
  //         session_name: this.requestData.session_name,
  //         ACTION: "VDADcheckINCOMING",
  //         user: "8001",
  //         pass: "tech159",
  //         campaign: "BOTSTEST",
  //       }).toString();

  //       const response = await axios.post(
  //         "https://balitechcl1.dialerhosting.com/agc/vdc_db_query.php",
  //         statusData
  //       );

  //       if (
  //         typeof response.data === "string" &&
  //         response.data.includes("ANSWER")
  //       ) {
  //         console.log("Call answered:", response.data);
  //         clearInterval(statusInterval);
  //       }
  //     } catch (error) {
  //       console.error("Error checking call status:", error);
  //     }
  //   }, 1000);

  //   // Clear interval after 60 seconds
  //   setTimeout(() => {
  //     clearInterval(statusInterval);
  //   }, 60000);
  // }

  // Original makeCall method with socket
  async makeCall() {
    try {
      const data = new URLSearchParams(this.requestData).toString();
      let config = {
        method: "post",
        maxBodyLength: Infinity,
        url: "https://balitechcl1.dialerhosting.com/agc/vdc_db_query.php",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        data: data,
      };

      const response = await axios.request(config);
      console.log("Call initiated:", response.data);

      // Parse and store call data
      if (typeof response.data === "string") {
        const [MDnextCID, lead_id, status, agent] = response.data.split("\n");
        this.callData = {
          MDnextCID,
          lead_id,
          agent_log_id: this.requestData.agent_log_id,
          call_id: MDnextCID,
        };
        console.log("Stored call data:", this.callData);
      }

      if (this.socket.connected) {
        if (!response.data.includes("ERROR")) {
          this.socket.emit("callInitiated", {
            status: "success",
            data: response.data,
          });
          this.monitorCallStatus();
        } else {
          this.socket.emit("callError", {
            status: "error",
            message: response.data,
          });
        }
      } else {
        // Fallback to non-socket version
        this.makeCallWithoutSocket();
      }

      return response.data;
    } catch (error) {
      console.error("Error making call:", error);
      if (this.socket.connected) {
        this.socket.emit("callError", { error: error.message });
      }
      throw error;
    }
  }

  async monitorCallStatus() {
    console.log("📞 Starting call status monitoring...");

    const statusInterval = setInterval(async () => {
      try {
        const statusData = new URLSearchParams({
          server_ip: "116.202.84.211",
          session_name: this.requestData.session_name,
          ACTION: "VDADcheckINCOMING",
          user: "8001",
          pass: "tech159",
          campaign: "BOTSTEST",
          agent_log_id: this.callData.agent_log_id,
          lead_id: this.callData.lead_id,
          uniqueid: this.callData.MDnextCID,
        }).toString();

        const response = await axios.post(
          "https://balitechcl1.dialerhosting.com/agc/vdc_db_query.php",
          statusData
        );

        console.log("📡 Status check response:", response.data);

        if (
          typeof response.data === "string" &&
          (response.data.includes("ANSWER") || response.data.includes("INCALL"))
        ) {
          console.log("✅ Call answered detected!");

          // Set call as active
          this.callActive = true;
          this.connectionEstablished = true;

          console.log(`
=================================
🎉 Connection Established!
🔌 Socket ID: ${this.socket.id}
📞 Call ID: ${this.callData.MDnextCID}
⏰ Time: ${new Date().toISOString()}
=================================
          `);

          // Emit call answered event with connection details
          this.socket.emit("callAnswered", {
            status: "answered",
            timestamp: new Date().toISOString(),
            callData: this.callData,
            connectionDetails: {
              socketId: this.socket.id,
              established: this.connectionEstablished,
              callActive: this.callActive,
            },
          });

          // Setup audio handling
          this.setupAudioHandling();

          clearInterval(statusInterval);
        }
      } catch (error) {
        console.error("❌ Error checking call status:", error);
      }
    }, 1000);

    // Clear interval after 60 seconds
    setTimeout(() => {
      clearInterval(statusInterval);
      console.log("Call status monitoring timed out");
    }, 60000);
  }

  setupAudioHandling() {
    console.log("🎧 Setting up audio handling...");

    // Handle incoming audio from server
    this.socket.on("incomingAudio", (audioData) => {
      console.log("🔊 Received incoming audio");
      if (this.callActive) {
        this.playAudioToCall(audioData);
      }
    });

    // Handle audio file playback request
    this.socket.on("playAudioFile", async (filename) => {
      console.log("📂 Audio file playback requested:", filename);
      if (this.callActive) {
        await this.playAudioFile(filename);
      }
    });

    console.log("✅ Audio handling setup complete");
  }

  async streamAudioFile() {
    try {
      // Read audio file
      const audioFile = path.join(__dirname, "audio.wav");
      const audioStream = fs.createReadStream(audioFile);

      // Stream the audio file in chunks
      audioStream.on("data", (chunk) => {
        this.socket.emit("audioChunk", {
          chunk: chunk,
          timestamp: Date.now(),
        });
      });

      audioStream.on("end", () => {
        console.log("Audio streaming completed");
        this.socket.emit("audioComplete");
      });

      audioStream.on("error", (error) => {
        console.error("Error streaming audio:", error);
        this.socket.emit("audioError", { error: error.message });
      });
    } catch (error) {
      console.error("Error streaming audio:", error);
      this.socket.emit("audioError", { error: error.message });
    }
  }

  async hangupCall() {
    try {
      const data = new URLSearchParams({
        server_ip: "116.202.84.211",
        session_name: this.requestData.session_name,
        ACTION: "HangupConfDial",
        format: "text",
        user: "8001",
        pass: "tech159",
        exten: "8600053",
        ext_context: "default",
        queryCID: "HTvdcW" + Math.floor(Date.now() / 1000) + "8001800180018001",
        log_campaign: "BOTSTEST",
        qm_extension: "8001",
      }).toString();

      let config = {
        method: "post",
        maxBodyLength: Infinity,
        url: "https://balitechcl1.dialerhosting.com/agc/manager_send.php",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        data: data,
      };

      const response = await axios.request(config);
      console.log("Call hung up:", response.data);
      return response.data;
    } catch (error) {
      console.error("Error hanging up call:", error);
      throw error;
    }
  }

  async markDisposition() {
    try {
      // Use stored call data
      const data = new URLSearchParams({
        server_ip: "116.202.84.211",
        session_name: this.requestData.session_name,
        ACTION: "updateDISPO",
        format: "text",
        user: "8001",
        pass: "tech159",
        dispo_choice: "CALLBK",
        lead_id: this.callData.lead_id,
        campaign: "BOTSTEST",
        agent_log_id: this.callData.agent_log_id,
        call_id: this.callData.MDnextCID,
        status: "CALLBK",
      }).toString();

      let config = {
        method: "post",
        maxBodyLength: Infinity,
        url: "https://balitechcl1.dialerhosting.com/agc/vdc_db_query.php",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        data: data,
      };

      const response = await axios.request(config);
      console.log("Disposition marked:", response.data);
      return response.data;
    } catch (error) {
      console.error("Error marking disposition:", error);
      throw error;
    }
  }
}

// Create and execute
const dialer = new Dialer();
dialer.makeCall().catch(console.error);

module.exports = { Dialer };
