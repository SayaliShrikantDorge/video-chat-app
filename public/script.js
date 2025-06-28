const socket = io();
let localStream;
let peerConnection;

const config = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const muteBtn = document.getElementById('muteBtn');
const endCallBtn = document.getElementById('endCallBtn');

const roomId = prompt("Enter Room ID:");
socket.emit('join-room', roomId);

navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    localStream = stream;
    localVideo.srcObject = stream;
  });

function startPeerConnection() {
  peerConnection = new RTCPeerConnection(config);
  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  peerConnection.ontrack = event => {
    remoteVideo.srcObject = event.streams[0];
  };

  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      socket.emit('ice-candidate', { candidate: event.candidate, roomId });
    }
  };
}

// Caller (first tab)
function makeCall() {
  startPeerConnection();

  peerConnection.createOffer()
    .then(offer => {
      peerConnection.setLocalDescription(offer);
      socket.emit('offer', { offer, roomId });
    });
}

// Receiver (second tab)
socket.on('offer', ({ offer }) => {
  startPeerConnection();
  peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
    .then(() => peerConnection.createAnswer())
    .then(answer => {
      peerConnection.setLocalDescription(answer);
      socket.emit('answer', { answer, roomId });
    });
});

socket.on('answer', ({ answer }) => {
  peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on('ice-candidate', ({ candidate }) => {
  if (peerConnection) {
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }
});

// Buttons
muteBtn.onclick = () => {
  const audioTrack = localStream.getAudioTracks()[0];
  audioTrack.enabled = !audioTrack.enabled;
  muteBtn.textContent = audioTrack.enabled ? "🔇 Mute" : "🔊 Unmute";
};

endCallBtn.onclick = () => {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
    remoteVideo.srcObject = null;
    alert("Call ended.");
  }
};

// Start call for the first user
setTimeout(() => {
  makeCall(); // Auto-initiate after loading
}, 1000);
