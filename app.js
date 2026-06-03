// app.js (草圖UI復刻 + 導遊/遊客雙端 QR Code 抽屜 + 免費 Web Speech CC 字幕大腦)
const LIVEKIT_SERVER_URL = "wss://whisper-tour-enlho56l.livekit.cloud";
const VERCEL_BACKEND_URL = "https://whisper-tour-drab.vercel.app/api/token";

let currentRoom = null;
let currentRoomCode = "";
let audioAnalyser = null; 
let animationId = null;   
let speechRecognizer = null;

let isCCEnabled = true; // 遊客端字幕初始狀態

// ⚡ 網頁加載第一時間：白嫖網址直通參數偵測
window.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const autoRoom = urlParams.get('room');
  
  if (autoRoom && autoRoom.trim().length === 4) {
    switchScreen(2);
    document.getElementById("inputRoomCode").value = autoRoom.trim();
    document.getElementById("rxStatus").innerText = "📢 已透過 QR Code 鎖定頻道，請輸入暱稱後點擊確認加入";
  }
});

/* 畫面切換控制 */
window.switchScreen = function(screenNum) {
  document.getElementById("screen-1").style.display = "none";
  document.getElementById("screen-2").style.display = "none";
  document.getElementById("screen-3").style.display = "none";
  document.getElementById("screen-4").style.display = "none";

  if (screenNum === 1) document.getElementById("screen-1").style.display = "block";
  if (screenNum === 2) document.getElementById("screen-2").style.display = "block";
  if (screenNum === 3) document.getElementById("screen-3").style.display = "block";
  if (screenNum === 4) document.getElementById("screen-4").style.display = "block";
}

/* 導遊控制台初始化 */
window.toGuideScreen = function() {
  switchScreen(3);
  currentRoomCode = Math.floor(1000 + Math.random() * 9000).toString();
  document.getElementById("displayRoomCode").innerText = currentRoomCode;
  
  const btn = document.getElementById("mainMicBtn");
  btn.disabled = true;
  btn.style.backgroundColor = "#020617";
  btn.style.borderColor = "#0f172a";
  btn.style.opacity = "0.4";
  document.getElementById("micEmoji").className = "text-5xl filter grayscale opacity-30";
  document.getElementById("micBtnText").innerText = "等待連線";
  document.getElementById("txStatusText").innerText = "未連線";
  document.getElementById("txSignalLight").className = "w-2.5 h-2.5 rounded-full bg-slate-600";
  document.getElementById("guide-cc-text").innerText = "🎙️ 免費即時字幕：尚未說話";
  
  // 重置導遊端折疊按鈕
  const qrBtn = document.getElementById("qrToggleBtn");
  qrBtn.disabled = true;
  qrBtn.classList.add("opacity-40", "cursor-not-allowed");
  qrBtn.classList.remove("border-cyan-500/40", "text-cyan-400", "cursor-pointer");
  document.getElementById("qrBtnText-guide").innerText = "顯示 QR Code";
  document.getElementById("qrcode-container-guide").style.display = "none";
  document.getElementById("qrcode-guide").innerHTML = "";
}

/* 📱 雙端通用：控制 QR Code 面板摺疊抽屜 */
window.toggleQRCode = function(identity) {
  const container = document.getElementById(`qrcode-container-${identity}`);
  const btnText = document.getElementById(`qrBtnText-${identity}`);
  
  if (container.style.display === "none" || container.classList.contains("hidden")) {
    container.style.display = "flex";
    container.classList.remove("hidden");
    btnText.innerText = identity === "guide" ? "隱藏 QR Code" : "隱藏分享 QR Code";
  } else {
    container.style.display = "none";
    container.classList.add("hidden");
    btnText.innerText = identity === "guide" ? "顯示 QR Code" : "顯示分享 QR Code";
  }
}

/* 🎬 遊客端：控制 CC 字幕開啟與掐死 */
window.toggleCCDisplay = function() {
  const toggleText = document.getElementById("ccToggleText");
  const toggleBtn = document.getElementById("ccToggleBtn");
  
  isCCEnabled = !isCCEnabled;
  
  if (isCCEnabled) {
    toggleText.innerText = "CC 字幕：開啟";
    toggleBtn.classList.add("border-emerald-500/40", "text-emerald-400");
    toggleBtn.classList.remove("border-slate-800", "text-slate-500");
    document.getElementById("tourist-cc-text").innerText = "📢 字幕接收中...";
  } else {
    toggleText.innerText = "CC 字幕：已關";
    toggleBtn.classList.remove("border-emerald-500/40", "text-emerald-400");
    toggleBtn.classList.add("border-slate-800", "text-slate-500");
    document.getElementById("tourist-cc-text").innerText = "🔇 字幕功能已關閉";
  }
}

/* 📢 導遊連線開房 */
window.connectAsGuide = async function() {
  try {
    document.getElementById("txStatusText").innerText = "GET TOKEN...";
    document.getElementById("txSignalLight").className = "w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_#f59e0b]";

    const response = await fetch(`${VERCEL_BACKEND_URL}?room=${currentRoomCode}&identity=Guide&isGuide=true`);
    const data = await response.json();
    if (data.error) throw new Error(data.error);

    document.getElementById("txStatusText").innerText = "CONNECTING...";
    const LK = window.LiveKitClient || window.LivekitClient || LiveKitClient;
    if (!LK) throw new Error("LiveKit SDK 載入失敗");

    currentRoom = new LK.Room();
    await currentRoom.connect(LIVEKIT_SERVER_URL, data.token);

    document.getElementById("txStatusText").innerText = "STANDBY (守聽)";
    document.getElementById("txSignalLight").className = "w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]";
    
    const btn = document.getElementById("mainMicBtn");
    btn.disabled = false; btn.style.opacity = "1"; btn.style.cursor = "pointer";
    btn.style.backgroundColor = "#090d16"; btn.style.borderColor = "#1e293b";
    
    document.getElementById("micEmoji").className = "text-5xl filter-none opacity-100";
    document.getElementById("micBtnText").innerText = "按住說話";
    document.getElementById("micBtnText").className = "text-xs font-black mt-3 text-cyan-400 tracking-wider";

    // 📱 連線成功：點亮導遊端 QR 折疊鈕並繪製二維碼
    const qrBtn = document.getElementById("qrToggleBtn");
    qrBtn.disabled = false;
    qrBtn.classList.remove("opacity-40", "cursor-not-allowed");
    qrBtn.classList.add("border-cyan-500/40", "text-cyan-400", "cursor-pointer");
    generateQRCodeEngine("qrcode-guide", currentRoomCode);

    // 🔌 綁定長按發話事件
    btn.onmousedown = startTransmission; btn.onmouseup = stopTransmission;
    btn.ontouchstart = startTransmission; btn.ontouchend = stopTransmission;

    initFreeSpeechRecognition();

  } catch (err) {
    console.error(err);
    document.getElementById("txStatusText").innerText = "連線失敗";
    document.getElementById("txSignalLight").className = "w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]";
    alert("導遊連線失敗：" + err.message);
  }
}

/* 🎛️ 統一高精細度 QR Code 生成引擎 */
function generateQRCodeEngine(elementId, roomCode) {
  const currentBaseUrl = window.location.origin + window.location.pathname;
  const touristInviteUrl = `${currentBaseUrl}?room=${roomCode}`;
  document.getElementById(elementId).innerHTML = "";
  
  new QRCode(document.getElementById(elementId), {
    text: touristInviteUrl,
    width: 140,
    height: 140,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });
}

/* 🧠 初始化免費語音辨識大腦 */
function initFreeSpeechRecognition() {
  const SpeechClass = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechClass) {
    document.getElementById("guide-cc-text").innerText = "⚠️ 瀏覽器不支援免費字幕晶片";
    return;
  }
  speechRecognizer = new SpeechClass();
  speechRecognizer.continuous = true;     
  speechRecognizer.interimResults = true; 
  speechRecognizer.lang = 'zh-TW';        

  speechRecognizer.onresult = (event) => {
    let resultText = "";
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      resultText += event.results[i][0].transcript;
    }
    // 1. 更新導遊自己的小預覽
    document.getElementById("guide-cc-text").innerText = "💬 " + resultText;

    // 2. 📡 通過 LiveKit 數據通道秒級閃電盲發出去
    if (currentRoom && resultText.trim() !== "") {
      const encoder = new TextEncoder();
      const payload = encoder.encode(JSON.stringify({ type: "cc-subtitle", text: resultText }));
      currentRoom.localParticipant.publishData(payload, { reliable: true });
    }
  };
}

/* 🔴 開始發話 */
async function startTransmission(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  if (!currentRoom) return;
  try {
    await currentRoom.localParticipant.setMicrophoneEnabled(true);
    document.getElementById("txStatusText").innerText = "TRANSMIT (TX)";
    document.getElementById("txSignalLight").className = "w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_12px_#ef4444]";
    const btn = document.getElementById("mainMicBtn");
    btn.style.backgroundColor = "#7f1d1d"; btn.style.borderColor = "#ef4444";     
    document.getElementById("micBtnText").innerText = "正在發話";
    document.getElementById("micBtnText").className = "text-xs font-black mt-3 text-red-400 tracking-wider";

    const LK = window.LiveKitClient || window.LivekitClient || LiveKitClient;
    const localAudioTrack = currentRoom.localParticipant.getTrackPublication(LK.Track.Source.Microphone || "microphone");
    if (localAudioTrack && localAudioTrack.track && localAudioTrack.track.mediaStream) {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(localAudioTrack.track.mediaStream);
      audioAnalyser = audioContext.createAnalyser(); audioAnalyser.fftSize = 32;
      source.connect(audioAnalyser); const dataArray = new Uint8Array(audioAnalyser.frequencyBinCount);
      function animateWave() {
        if (!audioAnalyser) return; audioAnalyser.getByteFrequencyData(dataArray);
        let sum = 0; for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const vol = sum / dataArray.length; const scale = 1.0 + (vol / 255) * 0.55; const opacity = vol > 8 ? 0.2 + (vol / 255) * 0.8 : 0;
        document.getElementById("micWaveRing").style.transform = `scale(${scale})`; document.getElementById("micWaveRing").style.opacity = opacity;
        document.getElementById("micWaveRingOuter").style.transform = `scale(${scale * 1.25})`; document.getElementById("micWaveRingOuter").style.opacity = opacity * 0.4;
        animationId = requestAnimationFrame(animateWave);
      }
      animateWave();
    }
    if (speechRecognizer) { try { speechRecognizer.start(); } catch(err){} }
  } catch (err) { console.error(err); }
}

/* 🟢 停止發話 */
async function stopTransmission(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  if (!currentRoom) return;
  try {
    await currentRoom.localParticipant.setMicrophoneEnabled(false);
    document.getElementById("txStatusText").innerText = "STANDBY (守聽)";
    document.getElementById("txSignalLight").className = "w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]";
    const btn = document.getElementById("mainMicBtn");
    btn.style.backgroundColor = "#090d16"; btn.style.borderColor = "#1e293b";
    document.getElementById("micBtnText").innerText = "按住說話";
    document.getElementById("micBtnText").className = "text-xs font-black mt-3 text-cyan-400 tracking-wider";

    if (animationId) { cancelAnimationFrame(animationId); animationId = null; }
    audioAnalyser = null;
    document.getElementById("micWaveRing").style.transform = "scale(1)"; document.getElementById("micWaveRing").style.opacity = "0";
    document.getElementById("qrcode-container-guide").style.transform = "scale(1)";
    if (speechRecognizer) { try { speechRecognizer.stop(); } catch(err){} }
  } catch (err) { console.error(err); }
}

/* 🎧 遊客加入頻道 */
window.enterTouristChannel = async function() {
  try {
    const roomCode = document.getElementById("inputRoomCode").value.trim();
    const nickname = document.getElementById("inputNickname").value.trim() || "匿名遊客";
    if (!roomCode) return alert('請輸入房號！');

    document.getElementById("rxStatus").innerText = "正在獲取安全通行證...";
    const response = await fetch(`${VERCEL_BACKEND_URL}?room=${roomCode}&identity=${encodeURIComponent(nickname)}&isGuide=false`);
    const data = await response.json();
    
    document.getElementById("rxStatus").innerText = "正在接入對講頻道...";
    const LK = window.LiveKitClient || window.LivekitClient || LiveKitClient;
    currentRoom = new LK.Room();

    // 🔊 監聽語音串流
    currentRoom.on(LK.RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === "audio") {
        track.attach();
        document.getElementById("rxStatus").innerText = "已成功接入頻道！";
        
        // 🚀 一鍵切換至 Screen 4 遊客專屬守聽儀表板
        switchScreen(4);
        document.getElementById("touristDisplayRoom").innerText = roomCode;
        document.getElementById("touristDisplayNickname").innerText = nickname;
        
        // 📱 在背景同步繪製好遊客端分享 QR Code
        generateQRCodeEngine("qrcode-tourist", roomCode);
      }
    });
    
    currentRoom.on(LK.RoomEvent.TrackUnsubscribed, (track) => {
      if (track.kind === "audio") {
        document.getElementById("rxStatus").innerText = "頻道待機守聽中";
      }
    });

    // 🎬 監聽並解碼導遊發過來的 CC 字幕數據
    currentRoom.on(LK.RoomEvent.DataReceived, (payload, participant) => {
      if (!isCCEnabled) return; 
      try {
        const decoder = new TextEncoder();
        const data = JSON.parse(decoder.decode(payload));
        if (data.type === "cc-subtitle") {
          document.getElementById("tourist-cc-text").innerText = data.text;
        }
      } catch (err) { console.error(err); }
    });

    await currentRoom.connect(LIVEKIT_SERVER_URL, data.token);

  } catch (err) {
    console.error(err);
    document.getElementById("rxStatus").innerText = "連線失敗";
    alert("加入失敗：" + err.message);
  }
}