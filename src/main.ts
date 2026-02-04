import ZoomVideo, { event_peer_video_state_change, VideoPlayer, VideoQuality } from "@zoom/videosdk";
import "./style.css";

const videoContainer = document.querySelector('video-player-container') as HTMLElement;
const sessionName = "TestOne";
const username = `User-${String(new Date().getTime()).slice(6)}`;
const client = ZoomVideo.createClient();
await client.init("en-US", "Global", { patchJsMedia: true });

// input a token to join the session - in production this will be done by your backend
const startCall = async (token: string) => {
  client.on("peer-video-state-change", renderVideo);
  await client.join(sessionName, token, username);
  const mediaStream = client.getMediaStream();
  await mediaStream.startAudio();
  await mediaStream.startVideo();
  await renderVideo({ action: 'Start', userId: client.getCurrentUserInfo().userId });
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

const leaveCall = async () => {
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
  await leaveCall();
  stopBtn.style.display = "none";
  startBtn.style.display = "block";
  startBtn.innerHTML = `Join: ${sessionName}`
  startBtn.disabled = false;
});

toggleVideoBtn.addEventListener("click", async () => {
  await toggleVideo();
});
