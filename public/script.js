const socket = io();
const videoGrid = document.getElementById("video-grid");
const chatBox = document.getElementById("chat-messages");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const muteBtn = document.getElementById("muteBtn");
const shareBtn = document.getElementById("shareScreenBtn");
const recordBtn = document.getElementById("recordBtn");

let localStream;
let mediaRecorder;
let isRecording = false;
let recordedChunks = [];

const peers = {};
const connections = {};
const myVideo = document.createElement("video");
myVideo.muted = true;
const userId = crypto.randomUUID();
const roomId = prompt("Enter Room ID:");

navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    localStream = stream;
    addVideo(userId, stream);
    socket.emit("join-room", roomId, userId);

    socket.on("all-users", users => {
      users.forEach(id => connectToNewUser(id, stream));
    });

    socket.on("user-connected", id => connectToNewUser(id, stream));

    socket.on("offer", async ({ sdp, sender }) => {
      const pc = createConnection(sender);
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("answer", { sdp: pc.localDescription, target: sender });
    });

    socket.on("answer", ({ sdp, sender }) => {
      connections[sender].setRemoteDescription(new RTCSessionDescription(sdp));
    });

    socket.on("ice-candidate", ({ candidate, sender }) => {
      connections[sender]?.addIceCandidate(new RTCIceCandidate(candidate));
    });

    socket.on("user-disconnected", id => {
      peers[id]?.remove();
      connections[id]?.close();
      delete peers[id];
      delete connections[id];
    });

    socket.on("chat", ({ name, message }) => {
      chatBox.innerHTML += `<div><b>${name}</b>: ${message}</div>`;
      chatBox.scrollTop = chatBox.scrollHeight;
    });
  });

function connectToNewUser(remoteId, stream) {
  const pc = createConnection(remoteId);
  connections[remoteId] = pc;
  stream.getTracks().forEach(track => pc.addTrack(track, stream));
  pc.createOffer()
    .then(offer => pc.setLocalDescription(offer))
    .then(() => socket.emit("offer", { sdp: pc.localDescription, target: remoteId }));
}

function createConnection(id) {
  const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
  pc.ontrack = event => {
    const remoteStream = event.streams[0];
    if (!peers[id]) addVideo(id, remoteStream);
  };
  pc.onicecandidate = event => {
    if (event.candidate) socket.emit("ice-candidate", { candidate: event.candidate, target: id });
  };
  return pc;
}

function addVideo(id, stream) {
  if (peers[id]) return;
  const video = document.createElement("video");
  video.srcObject = stream;
  video.autoplay = true;
  video.playsInline = true;
  video.setAttribute("data-id", id);
  videoGrid.append(video);
  peers[id] = video;
}

// Chat
sendBtn.onclick = () => {
  const msg = chatInput.value.trim();
  if (msg) {
    socket.emit("chat", { name: "You", message: msg });
    chatBox.innerHTML += `<div><b>You</b>: ${msg}</div>`;
    chatBox.scrollTop = chatBox.scrollHeight;
    chatInput.value = "";
  }
};

// Mute toggle
muteBtn.onclick = () => {
  const audio = localStream.getAudioTracks()[0];
  audio.enabled = !audio.enabled;
  muteBtn.textContent = audio.enabled ? "🔇 Mute" : "🔊 Unmute";
};

// Screen share
shareBtn.onclick = async () => {
  const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
  const screenTrack = screenStream.getVideoTracks()[0];
  Object.values(connections).forEach(pc => {
    const sender = pc.getSenders().find(s => s.track.kind === "video");
    sender.replaceTrack(screenTrack);
  });
  screenTrack.onended = () => {
    Object.values(connections).forEach(pc => {
      const sender = pc.getSenders().find(s => s.track.kind === "video");
      sender.replaceTrack(localStream.getVideoTracks()[0]);
    });
  };
};

// Screen recording
recordBtn.onclick = () => {
  if (!isRecording) {
    mediaRecorder = new MediaRecorder(localStream);
    recordedChunks = [];
    mediaRecorder.ondataavailable = e => recordedChunks.push(e.data);
    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "recording.webm";
      a.click();
    };
    mediaRecorder.start();
    isRecording = true;
    recordBtn.textContent = "⏹️ Stop Recording";
  } else {
    mediaRecorder.stop();
    isRecording = false;
    recordBtn.textContent = "⏺️ Start Recording";
  }
};
