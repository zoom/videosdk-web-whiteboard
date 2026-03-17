import ZoomVideo, { event_peer_video_state_change, VideoPlayer, VideoQuality } from "@zoom/videosdk";
import "./style.css";

const videoContainer = document.querySelector('video-player-container') as HTMLElement;
const sessionName = "TestOne";
const username = `User-${String(new Date().getTime()).slice(6)}`;
const client = ZoomVideo.createClient();
await client.init("en-US", "Global", { patchJsMedia: true });

let whiteboardClient: ReturnType<typeof client.getWhiteboardClient>;

// input a token to join the session - in production this will be done by your backend
const startCall = async (token: string) => {
  client.on("peer-video-state-change", renderVideo);
  await client.join(sessionName, token, username);
  const mediaStream = client.getMediaStream();
  await mediaStream.startAudio();
  await mediaStream.startVideo();
  await renderVideo({ action: 'Start', userId: client.getCurrentUserInfo().userId });

  // Initialize whiteboard
  whiteboardClient = client.getWhiteboardClient();
  setupWhiteboard();
};

const renderVideo: typeof event_peer_video_state_change = async (event) => {
  const mediaStream = client.getMediaStream();
  if (event.action === 'Stop') {
    const element = await mediaStream.detachVideo(event.userId);
    if (Array.isArray(element)) { element.forEach((el) => el.remove()) }
    else if (element) { element.remove(); }
  } else {
    const userVideo = await mediaStream.attachVideo(event.userId, VideoQuality.Video_360P);
    videoContainer.appendChild(userVideo as VideoPlayer);
  }
};

const showWhiteboard = () => {
  whiteboardContainer.classList.remove("hidden");
  document.body.classList.add("whiteboard-active");
};

const hideWhiteboard = () => {
  whiteboardContainer.classList.add("hidden");
  document.body.classList.remove("whiteboard-active");
};

const setupWhiteboard = () => {
  if (!whiteboardClient.isWhiteboardEnabled()) {
    alert("Whiteboard is not supported on this device");
    return;
  }

  whiteboardBtn.style.display = "block";

  // Listen for whiteboard state changes from other participants
  client.on("peer-whiteboard-state-change", async (payload) => {
    const { action, userId } = payload;
    if (action === "Start") {
      showWhiteboard();
      await whiteboardClient.startWhiteboardView(whiteboardContainer, userId);
      whiteboardBtn.textContent = "Viewing Whiteboard";
      whiteboardBtn.disabled = true;
      exportWhiteboardBtn.style.display = "block";
    } else if (action === "Stop") {
      await whiteboardClient.stopWhiteboardView();
      hideWhiteboard();
      whiteboardBtn.textContent = "Start Whiteboard";
      whiteboardBtn.disabled = false;
      exportWhiteboardBtn.style.display = "none";
    }
  });

  // Handle late joins - check if a whiteboard is already active
  const presenter = whiteboardClient.getWhiteboardPresenter();
  if (presenter) {
    showWhiteboard();
    whiteboardClient.startWhiteboardView(whiteboardContainer, presenter.userId);
    whiteboardBtn.textContent = "Viewing Whiteboard";
    whiteboardBtn.disabled = true;
    exportWhiteboardBtn.style.display = "block";
  }
};

const toggleWhiteboard = async () => {
  const isPresenting = whiteboardClient.getWhiteboardPresenter()?.userId === client.getCurrentUserInfo().userId;
  if (isPresenting) {
    await whiteboardClient.stopWhiteboardScreen();
    hideWhiteboard();
    whiteboardBtn.textContent = "Start Whiteboard";
    exportWhiteboardBtn.style.display = "none";
  } else {
    showWhiteboard();
    await whiteboardClient.startWhiteboardScreen(whiteboardContainer);
    whiteboardBtn.textContent = "Stop Whiteboard";
    exportWhiteboardBtn.style.display = "block";
  }
};

const leaveCall = async () => {
  if (whiteboardClient) {
    const presenter = whiteboardClient.getWhiteboardPresenter();
    if (presenter?.userId === client.getCurrentUserInfo().userId) {
      await whiteboardClient.stopWhiteboardScreen();
    } else if (presenter) {
      await whiteboardClient.stopWhiteboardView();
    }
  }

  const mediaStream = client.getMediaStream();
  for (const user of client.getAllUser()) {
    const element = await mediaStream.detachVideo(user.userId);
    if (Array.isArray(element)) { element.forEach((el) => el.remove()) }
    else if (element) { element.remove(); }
  }
  client.off("peer-video-state-change", renderVideo);
  await client.leave();
}

const toggleVideo = async () => {
  const mediaStream = client.getMediaStream();
  if (mediaStream.isCapturingVideo()) {
    await mediaStream.stopVideo();
    await renderVideo({ action: 'Stop', userId: client.getCurrentUserInfo().userId });
  } else {
    await mediaStream.startVideo();
    await renderVideo({ action: 'Start', userId: client.getCurrentUserInfo().userId });
  }
};

// UI Logic
const startBtn = document.querySelector("#start-btn") as HTMLButtonElement;
const stopBtn = document.querySelector("#stop-btn") as HTMLButtonElement;
const toggleVideoBtn = document.querySelector("#toggle-video-btn") as HTMLButtonElement;
const whiteboardBtn = document.querySelector("#whiteboard-btn") as HTMLButtonElement;
const exportWhiteboardBtn = document.querySelector("#export-whiteboard-btn") as HTMLButtonElement;
const whiteboardContainer = document.querySelector("#whiteboard-container") as HTMLDivElement;

startBtn.innerHTML = `Join: ${sessionName}`
startBtn.addEventListener("click", async () => {
  const token = window.prompt("Enter a token");
  if (!token) {
    alert("Please enter a token");
    return;
  }
  startBtn.innerHTML = "Connecting...";
  startBtn.disabled = true;
  await startCall(token);
  startBtn.innerHTML = "Connected";
  startBtn.style.display = "none";
  stopBtn.style.display = "block";
  toggleVideoBtn.style.display = "block";
});

stopBtn.addEventListener("click", async () => {
  toggleVideoBtn.style.display = "none";
  whiteboardBtn.style.display = "none";
  exportWhiteboardBtn.style.display = "none";
  hideWhiteboard();
  await leaveCall();
  stopBtn.style.display = "none";
  startBtn.style.display = "block";
  startBtn.innerHTML = `Join: ${sessionName}`
  startBtn.disabled = false;
});

toggleVideoBtn.addEventListener("click", toggleVideo);
whiteboardBtn.addEventListener("click", toggleWhiteboard);
exportWhiteboardBtn.addEventListener("click", () => {
  whiteboardClient.exportWhiteboard("pdf", `whiteboard-${sessionName}`);
});
