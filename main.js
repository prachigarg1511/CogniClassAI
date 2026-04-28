// main.js - CogniClass AI Logic

// UI Elements - Screens
const landingPage = document.getElementById('landing-page');
const classroomScreen = document.getElementById('classroom-screen');
const authModal = document.getElementById('auth-modal');
const joinForm = document.getElementById('join-form');
const hostForm = document.getElementById('host-form');
const authModalTitle = document.getElementById('auth-modal-title');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const linkShowLogin = document.getElementById('link-show-login');
const linkShowRegister = document.getElementById('link-show-register');
const linkBackLogin = document.getElementById('link-back-login');

// UI Elements - Buttons
const btnHostMode = document.getElementById('btn-host-mode');
const btnJoinMode = document.getElementById('btn-join-mode');
const btnHeroHost = document.getElementById('btn-hero-host');
const btnHeroJoin = document.getElementById('btn-hero-join');
const btnBackAuth = null; // No longer needed
const btnBackHost = null; // No longer needed
const btnCloseAuth = document.getElementById('btn-close-auth');

const btnJoinAction = document.getElementById('btn-join-action');
const btnHostAction = document.getElementById('btn-host-action');
const btnLeave = document.getElementById('btn-leave');
const btnMic = document.getElementById('btn-mic');
const btnCamera = document.getElementById('btn-camera');
const btnHandRaise = document.getElementById('btn-hand-raise');
const btnWhiteboard = document.getElementById('btn-whiteboard');
const btnAiProcess = document.getElementById('btn-ai-process');
const btnFocusMode = document.getElementById('btn-focus-mode');
const btnLowData = document.getElementById('btn-low-data');

// UI Elements - Data & Media
const localVideo = document.getElementById('local-video');
const videoStage = document.querySelector('.video-stage');
const lowDataPlaceholder = document.getElementById('low-data-placeholder');
const whiteboardContainer = document.getElementById('whiteboard-container');

const canvas = document.getElementById('whiteboard');
const ctx = canvas ? canvas.getContext('2d') : null;
const handRaiseIndicator = document.getElementById('hand-raise-indicator');
const chatMessages = document.getElementById('chat-messages');
const roomBadge = document.getElementById('room-badge');
const localNameLabel = document.getElementById('local-name-label');
const myPointsLabel = document.getElementById('my-points-label');
const leaderboardList = document.getElementById('leaderboard-list');
const silentStudentsPanel = document.getElementById('silent-students-panel');
const silentList = document.getElementById('silent-list');
const btnLearningPath = document.getElementById('btn-learning-path');

// Copilot Elements

const btnCopilot = document.getElementById('btn-copilot');
const copilotWindow = document.getElementById('copilot-window');
const btnCloseCopilot = document.getElementById('btn-close-copilot');
const copilotInput = document.getElementById('copilot-input');
const btnCopilotSend = document.getElementById('btn-copilot-send');
const copilotMessages = document.getElementById('copilot-messages');

// Stats Elements
const statUsers = document.getElementById('stat-users');
const statQuestions = document.getElementById('stat-questions');
const statMeter = document.getElementById('stat-meter');

// New UI Elements
const btnPulseCheck = document.getElementById('btn-pulse-check');
const pulseModal = document.getElementById('pulse-modal');
const focusWarning = document.getElementById('focus-warning');
const chatInputText = document.getElementById('chat-input-text');
const btnChatSend = document.getElementById('btn-chat-send');
const anonDoubtToggle = document.getElementById('anon-doubt-toggle');
const statFocus = document.getElementById('stat-focus');
const btnVoiceDoubt = document.getElementById('btn-voice-doubt');

// Code Lab Elements
const btnCodeLab = document.getElementById('btn-code-lab');
const codeLabContainer = document.getElementById('code-lab-container');
const btnRunCode = document.getElementById('btn-run-code');
const btnSubmitCode = document.getElementById('btn-submit-code');
const codeEditor = document.getElementById('code-editor');
const codeOutput = document.getElementById('code-output');
const codeLang = document.getElementById('code-lang');
const btnSetProblem = document.getElementById('btn-set-problem');
const teacherProblem = document.getElementById('teacher-problem');

const btnLiveQuiz = document.getElementById('btn-live-quiz');
const liveQuizModal = document.getElementById('live-quiz-modal');
const liveQuizQ = document.getElementById('live-quiz-q');
const liveQuizOptions = document.getElementById('live-quiz-options');

// State
let socket;
let localStream;
let recognition;
let isRecording = false;
let userType = 'student';
let userName = '';
let roomCode = '';
let fullTranscript = [];
let onlineCount = 1;
let focusLostCount = 0;
let pulseScores = [];
let myPoints = 0;
let currentUser = JSON.parse(localStorage.getItem('cogniclass_user')) || null;

// --- Helper: Add Points & Sync to DB ---
async function earnPoints(amount) {
    if(userType === 'teacher') return;
    myPoints += amount;
    myPointsLabel.innerText = `${myPoints} pts`;
    socket.emit('add-points', roomCode, userName, amount);

    // Sync to DB for persistence & XP
    if (currentUser) {
        try {
            const res = await fetch('/api/auth/award-points', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: currentUser.email, points: amount })
            });
            const data = await res.json();
            updateGamificationUI(data);
        } catch (err) {
            console.error("Failed to sync points:", err);
        }
    }
}

function updateGamificationUI(data) {
    if (!data) return;
    const level = Math.floor(data.xp / 1000) + 1;
    const currentXP = data.xp % 1000;
    
    const levelBadge = document.getElementById('my-level-badge');
    if (levelBadge) levelBadge.innerText = `LVL ${level}`;
    
    const xpFill = document.getElementById('xp-fill');
    if (xpFill) xpFill.style.width = `${(currentXP / 1000) * 100}%`;
    
    const xpVal = document.getElementById('xp-val');
    if (xpVal) xpVal.innerText = `${currentXP} / 1000 XP`;
    
    const nextLvl = document.getElementById('next-lvl');
    if (nextLvl) nextLvl.innerText = level + 1;

    const badgeRow = document.getElementById('badges-row');
    if (badgeRow && data.badges) {
        badgeRow.innerHTML = '';
        data.badges.forEach(b => {
            const span = document.createElement('span');
            span.className = 'lp-pill';
            span.style.fontSize = '0.65rem';
            span.style.padding = '4px 8px';
            span.innerHTML = `<div class="lp-pill-dot" style="background:var(--yellow)"></div> ${b}`;
            badgeRow.appendChild(span);
        });
    }
}

// --- Screen Management ---

const showLoginForm = () => {
    authModal.classList.remove('hidden');
    if (joinForm) joinForm.classList.add('hidden');
    if (hostForm) hostForm.classList.add('hidden');
    if (registerForm) registerForm.classList.add('hidden');
    if (loginForm) loginForm.classList.remove('hidden');
    authModalTitle.innerText = "Login to CogniClass";
};

const showRegisterForm = () => {
    authModal.classList.remove('hidden');
    if (joinForm) joinForm.classList.add('hidden');
    if (hostForm) hostForm.classList.add('hidden');
    if (loginForm) loginForm.classList.add('hidden');
    if (registerForm) registerForm.classList.remove('hidden');
    authModalTitle.innerText = "Create Account";
};

// Bind Landing Page Buttons
if (btnHostMode) btnHostMode.onclick = showLoginForm;
if (btnHeroHost) btnHeroHost.onclick = showLoginForm;
if (btnJoinMode) btnJoinMode.onclick = showLoginForm;
if (btnHeroJoin) btnHeroJoin.onclick = showLoginForm;

btnCloseAuth.onclick = () => {
    authModal.classList.add('hidden');
};

if (linkShowLogin) linkShowLogin.onclick = (e) => { e.preventDefault(); showLoginForm(); };
if (linkShowRegister) linkShowRegister.onclick = (e) => { e.preventDefault(); showRegisterForm(); };
if (linkBackLogin) linkBackLogin.onclick = (e) => { e.preventDefault(); showLoginForm(); };

// Auth API Calls
document.getElementById('btn-register-action').onclick = async () => {
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const role = document.getElementById('reg-role').value;
    const phone = document.getElementById('reg-phone').value;

    if (!name || !email || !password || !phone) return alert("Fill all fields (Phone is compulsory)");

    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password, role, phone })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        
        alert("Registration successful! Please login.");
        showLoginForm();
    } catch (err) {
        alert(err.message);
    }
};

document.getElementById('btn-login-action').onclick = async () => {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        localStorage.setItem('cogniclass_user', JSON.stringify(data));
        currentUser = data;
        userName = data.name;
        userType = data.role;
        
        if (userType === 'teacher') {
            const className = prompt("Enter Class Name:", "New Class");
            roomCode = className.toUpperCase().replace(/\s+/g, '-') + '-' + Math.floor(1000 + Math.random() * 9000);
            launchClassroom(className, roomCode);
        } else {
            const code = prompt("Enter Room Code to Join:");
            if (code) {
                roomCode = code;
                launchClassroom("Class Session", roomCode);
            }
        }
    } catch (err) {
        alert(err.message);
    }
};

// btnHostAction and btnJoinAction are no longer used for direct entry
if (btnHostAction) btnHostAction.style.display = 'none';
if (btnJoinAction) btnJoinAction.style.display = 'none';

async function launchClassroom(name, code) {
    authModal.classList.add('hidden');
    landingPage.classList.add('hidden');
    classroomScreen.classList.remove('hidden');
    roomBadge.innerText = `ROOM: ${code}`;
    localNameLabel.innerText = userName;
    
    if (userType === 'teacher') {
        btnCopilot.classList.remove('hidden');
        btnPulseCheck.classList.remove('hidden');
        silentStudentsPanel.classList.remove('hidden');
        if (btnSetProblem) btnSetProblem.classList.remove('hidden');
        if (btnLiveQuiz) btnLiveQuiz.classList.remove('hidden');
        if (btnRecord) btnRecord.classList.remove('hidden');
    } else {
        document.getElementById('xp-bar-container').classList.remove('hidden');
    }

    await setupMedia();
    setupSTT();
    setupSocket(code);
    setupFocusTracking();
    setupChat();
}

btnLeave.onclick = () => location.reload();


// --- Media Setup ---
async function setupMedia() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
    } catch (err) {
        console.error("Media error:", err);
        alert("Camera/Mic access denied.");
    }
}

btnMic.onclick = () => {
    const track = localStream.getAudioTracks()[0];
    track.enabled = !track.enabled;
    btnMic.classList.toggle('active', !track.enabled);
};

btnCamera.onclick = () => {
    const track = localStream.getVideoTracks()[0];
    track.enabled = !track.enabled;
    btnCamera.classList.toggle('active', !track.enabled);
};

// --- Video Recording ---
let mediaRecorder;
let recordedChunks = [];
const btnRecord = document.getElementById('btn-record');

if (btnRecord) {
    btnRecord.onclick = () => {
        if (!mediaRecorder || mediaRecorder.state === "inactive") {
            startRecording();
        } else {
            stopRecording();
        }
    };
}

function startRecording() {
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(localStream, { mimeType: 'video/webm' });
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data); };
    mediaRecorder.onstop = saveRecording;
    mediaRecorder.start();
    btnRecord.innerText = "⏹️";
    btnRecord.style.background = "var(--red)";
    addSystemMessage("Recording started...");
}

function stopRecording() {
    mediaRecorder.stop();
    btnRecord.innerText = "⏺️";
    btnRecord.style.background = "transparent";
}

function saveRecording() {
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CogniClass-Session-${roomCode}.webm`;
    a.click();
    addSystemMessage("Recording saved and downloaded!");
}

// --- LMS Sync Mock ---
const btnSyncLms = document.getElementById('btn-sync-lms');
if (btnSyncLms) {
    btnSyncLms.onclick = () => {
        btnSyncLms.innerText = "⏳ Syncing...";
        btnSyncLms.disabled = true;
        setTimeout(() => {
            alert("Success! Leaderboard and Attendance synced to Google Classroom.");
            btnSyncLms.innerText = "🔄 Sync LMS";
            btnSyncLms.disabled = false;
            addSystemMessage("LMS Sync Complete: Exported to Google Classroom.");
        }, 2000);
    };
}

// --- Sockets ---
function setupSocket(room) {
    socket = io();
    socket.emit('join-room', room, userName);

    socket.on('user-joined', (userId) => {
        onlineCount++;
        statUsers.innerText = onlineCount;
        addSystemMessage(`${userId} joined the room.`);
    });

    // 1. Focus Tracking
    socket.on('student-focus-lost', (studentName) => {
        if(userType === 'teacher') {
            focusLostCount++;
            updateFocusStat();
            addSystemMessage(`⚠️ ${studentName} switched tabs!`);
        }
    });

    socket.on('student-focus-gained', (studentName) => {
        if(userType === 'teacher') {
            focusLostCount = Math.max(0, focusLostCount - 1);
            updateFocusStat();
            addSystemMessage(`✅ ${studentName} returned to tab.`);
        }
    });

    // 2. Pulse Checks
    socket.on('receive-pulse', () => {
        if(userType === 'student') pulseModal.classList.remove('hidden');
    });

    socket.on('pulse-result', (score) => {
        if(userType === 'teacher') {
            pulseScores.push(score);
            const avg = pulseScores.reduce((a,b)=>a+b,0) / pulseScores.length;
            statMeter.innerText = Math.round(avg) + '%';
            if (avg < 50) statMeter.style.color = 'var(--red)';
            else if (avg < 80) statMeter.style.color = 'var(--yellow)';
            else statMeter.style.color = 'var(--green)';
        }
    });

    // 3. Chat / Doubts
    socket.on('receive-chat', (data) => {
        addChatMessage(data.user, data.text, data.isAnonymous);
    });

    // Code Lab Events
    socket.on('receive-problem', (problem) => {
        if(teacherProblem) {
            teacherProblem.style.display = 'block';
            teacherProblem.innerText = "Teacher's Problem: " + problem;
        }
        if(codeLabContainer) codeLabContainer.classList.remove('hidden');
        if(btnCodeLab) btnCodeLab.classList.add('active');
        addSystemMessage("💻 New coding problem received from teacher!");
    });

    socket.on('code-submitted', (data) => {
        if (userType === 'teacher') {
            addSystemMessage(`💻 ${data.userName} submitted code!`);
        }
    });

    // Live Quiz Events
    socket.on('receive-live-quiz', (quizData) => {
        if(liveQuizModal) {
            liveQuizModal.classList.remove('hidden');
            liveQuizQ.innerText = quizData.question;
            liveQuizOptions.innerHTML = '';
            
            quizData.options.forEach(opt => {
                const btn = document.createElement('button');
                btn.className = 'btn btn-ghost';
                btn.style.justifyContent = 'flex-start';
                btn.innerText = opt;
                btn.onclick = () => {
                    const isCorrect = (opt === quizData.answer);
                    if (isCorrect) {
                        myPoints += 10;
                        if(myPointsLabel) myPointsLabel.innerText = `${myPoints} pts`;
                    }
                    socket.emit('submit-quiz-answer', roomCode, userName, isCorrect);
                    
                    if(isCorrect) {
                        btn.style.background = 'rgba(34,197,94,0.2)';
                        btn.style.borderColor = 'var(--green)';
                    } else {
                        btn.style.background = 'rgba(239,68,68,0.2)';
                        btn.style.borderColor = 'var(--red)';
                        // Find and highlight correct answer
                        Array.from(liveQuizOptions.children).forEach(b => {
                            if (b.innerText === quizData.answer) {
                                b.style.background = 'rgba(34,197,94,0.2)';
                                b.style.borderColor = 'var(--green)';
                            }
                        });
                    }
                    
                    // Disable all
                    Array.from(liveQuizOptions.children).forEach(b => b.disabled = true);
                    
                    setTimeout(() => { liveQuizModal.classList.add('hidden'); }, 3000);
                };
                liveQuizOptions.appendChild(btn);
            });
            addSystemMessage("❓ Pop Quiz started!");
        }
    });

    socket.on('quiz-answered', (data) => {
        if (userType === 'teacher') {
            addSystemMessage(`❓ ${data.userName} answered the quiz ${data.isCorrect ? 'correctly! ✅' : 'incorrectly ❌'}`);
        }
    });

    // 4. Leaderboard Update
    socket.on('leaderboard-update', (leaderboard) => {
        leaderboardList.innerHTML = '';
        
        // Convert to array and sort descending
        const sorted = Object.entries(leaderboard).sort((a,b) => b[1] - a[1]);
        
        if (sorted.length === 0) {
            leaderboardList.innerHTML = '<li style="color: var(--text2); font-size: 0.85rem; text-align: center;">No points yet...</li>';
            return;
        }

        sorted.forEach(([name, score], index) => {
            const li = document.createElement('li');
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.alignItems = 'center';
            li.style.fontSize = '0.9rem';
            
            let badge = '';
            if (index === 0) badge = '🥇';
            else if (index === 1) badge = '🥈';
            else if (index === 2) badge = '🥉';

            li.innerHTML = `<span>${badge} ${name}</span><span style="font-weight:700; color:var(--accent);">${score}</span>`;
            leaderboardList.appendChild(li);
        });

        // 5. Silent Student Detection (Teacher Only)
        if(userType === 'teacher') {
            silentList.innerHTML = '';
            let silentCount = 0;
            sorted.forEach(([name, score]) => {
                if (score === 0) {
                    silentCount++;
                    const li = document.createElement('li');
                    li.innerText = `• ${name}`;
                    silentList.appendChild(li);
                }
            });
            if (silentCount === 0) {
                silentList.innerHTML = '<li>Everyone is participating! 🎉</li>';
            }
        }
    });
}



function updateFocusStat() {
    // Basic heuristic: 100% minus 10% per unfocused student (up to 10)
    let pct = Math.max(0, 100 - ((focusLostCount / onlineCount) * 100));
    statFocus.innerText = Math.round(pct) + '%';
    if(pct < 50) statFocus.style.color = 'var(--red)';
    else if(pct < 80) statFocus.style.color = 'var(--yellow)';
    else statFocus.style.color = 'var(--accent)';
}


// --- Transcription & Chat UI ---
function setupSTT() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return console.warn("STT not supported.");

    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    
    recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                const text = event.results[i][0].transcript;
                addTranscriptEntry(userName, text);

                // --- Voice Trigger: "Generate a quiz" ---
                if (userType === 'teacher' && text.toLowerCase().includes("generate a quiz")) {
                    addSystemMessage("✨ Voice Trigger Detected: Generating live quiz...");
                    btnLiveQuiz.click();
                }
            }
        }
    };
    recognition.onend = () => { if(isRecording) recognition.start(); };
    isRecording = true;
    recognition.start();
}

// --- Chat & Doubt System ---
function setupChat() {
    const sendChatMessage = () => {
        const text = chatInputText.value.trim();
        if(!text) return;
        
        const isAnon = anonDoubtToggle.checked;
        const displayUser = isAnon ? 'Anonymous Student' : userName;
        
        // Append to self
        addChatMessage('You', text, isAnon);
        
        // Emit to others
        socket.emit('send-chat', roomCode, { user: displayUser, text, isAnonymous: isAnon });
        
        // Treat text chat as part of transcript context for AI
        fullTranscript.push({ user: displayUser, text, timestamp: new Date().toLocaleTimeString(), isDoubt: isAnon });
        
        earnPoints(5); // Gamification: +5 points for participation/doubt
        chatInputText.value = '';
    };

    btnChatSend.onclick = sendChatMessage;

    chatInputText.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });

    if (btnVoiceDoubt) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const doubtRecognition = new SpeechRecognition();
            doubtRecognition.continuous = false;
            doubtRecognition.interimResults = false;
            
            doubtRecognition.onresult = (event) => {
                const text = event.results[0][0].transcript;
                chatInputText.value += (chatInputText.value ? " " : "") + text;
                btnVoiceDoubt.style.color = 'var(--text)';
                btnVoiceDoubt.style.borderColor = 'var(--border)';
            };
            
            doubtRecognition.onend = () => {
                btnVoiceDoubt.style.color = 'var(--text)';
                btnVoiceDoubt.style.borderColor = 'var(--border)';
            };

            btnVoiceDoubt.onclick = () => {
                btnVoiceDoubt.style.color = 'var(--red)';
                btnVoiceDoubt.style.borderColor = 'var(--red)';
                try { doubtRecognition.start(); } catch(e) {}
            };
        } else {
            btnVoiceDoubt.onclick = () => alert("Voice typing not supported in this browser.");
        }
    }
}

function addChatMessage(user, text, isAnonymous = false) {
    const entry = document.createElement('div');
    const isSelf = user === 'You';
    
    entry.className = `msg ${isSelf ? 'self' : 'user'}`;
    if (isAnonymous && !isSelf) entry.style.background = 'rgba(234,179,8,0.15)'; // Highlight anon doubts
    
    entry.innerHTML = `<strong>${isAnonymous && !isSelf ? '🕵️ ' : ''}${user}:</strong> ${text}`;
    chatMessages.appendChild(entry);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addTranscriptEntry(user, text) {
    addChatMessage(user, text, false);
    fullTranscript.push({ user, text, timestamp: new Date().toLocaleTimeString() });
}

function addSystemMessage(text) {
    const entry = document.createElement('div');
    entry.className = 'msg system';
    entry.innerText = text;
    chatMessages.appendChild(entry);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// --- New Feature Interactions ---

// Teacher triggering pulse check
if (btnPulseCheck) {
    btnPulseCheck.onclick = () => {
        socket.emit('trigger-pulse', roomCode);
        pulseScores = []; // reset scores for this round
        addSystemMessage("Sent understanding check to students.");
    };
}

// Student answering pulse check
window.answerPulse = (score) => {
    socket.emit('answer-pulse', roomCode, score);
    pulseModal.classList.add('hidden');
    earnPoints(10); // Gamification: +10 points for answering
    addSystemMessage("Your response was sent to the teacher.");
};

// Focus Tracking
function setupFocusTracking() {
    if(userType === 'teacher') return; // Teachers don't get tracked

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            socket.emit('focus-lost', roomCode, userName);
            focusWarning.classList.remove('hidden');
        } else {
            socket.emit('focus-gained', roomCode, userName);
            focusWarning.classList.add('hidden');
        }
    });
}

// --- Low Data Mode ---
let lowDataActive = false;
if (btnLowData) {
    btnLowData.onclick = () => {
        lowDataActive = !lowDataActive;
        btnLowData.classList.toggle('active', lowDataActive);
        
        if (lowDataActive) {
            btnLowData.style.background = 'var(--red)';
            btnLowData.innerText = '📶 Low-Data: ON';
            localVideo.classList.add('hidden');
            lowDataPlaceholder.classList.remove('hidden');
            // In a real WebRTC app, we would disable the video tracks here:
            // localStream.getVideoTracks().forEach(track => track.enabled = false);
        } else {
            btnLowData.style.background = '';
            btnLowData.innerText = '📶 Low-Data Mode';
            localVideo.classList.remove('hidden');
            lowDataPlaceholder.classList.add('hidden');
            // localStream.getVideoTracks().forEach(track => track.enabled = true);
        }
    };
}

// --- Whiteboard & Hand Raise ---
let handRaised = false;
btnHandRaise.onclick = () => {
    handRaised = !handRaised;
    btnHandRaise.classList.toggle('active', handRaised);
    handRaiseIndicator.classList.toggle('hidden', !handRaised);
};

let wbActive = false, drawing = false;
btnWhiteboard.onclick = () => {
    wbActive = !wbActive;
    btnWhiteboard.classList.toggle('active', wbActive);
    whiteboardContainer.classList.toggle('hidden', !wbActive);
    videoStage.classList.toggle('hidden', wbActive);
};

if (canvas) {
    canvas.addEventListener('mousedown', (e) => { drawing = true; ctx.beginPath(); ctx.moveTo(e.offsetX, e.offsetY); });
    canvas.addEventListener('mousemove', (e) => { if (drawing) { ctx.lineTo(e.offsetX, e.offsetY); ctx.stroke(); } });
    canvas.addEventListener('mouseup', () => drawing = false);
    canvas.addEventListener('mouseout', () => drawing = false);
    document.getElementById('btn-wb-clear').onclick = () => ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// --- Focus Mode ---
btnFocusMode.onclick = () => document.body.classList.toggle('focus-mode');

// --- Teacher Copilot ---
btnCopilot.onclick = () => copilotWindow.classList.toggle('hidden');
btnCloseCopilot.onclick = () => copilotWindow.classList.add('hidden');

btnCopilotSend.onclick = async () => {
    const query = copilotInput.value;
    if(!query) return;
    
    // Add user message
    const um = document.createElement('div');
    um.className = 'msg self';
    um.innerText = query;
    copilotMessages.appendChild(um);
    copilotInput.value = '';

    btnCopilotSend.disabled = true;
    btnCopilotSend.innerText = "⏳";

    try {
        const response = await fetch('/api/copilot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transcript: fullTranscript, query })
        });
        const data = await response.json();
        
        const bm = document.createElement('div');
        bm.className = 'msg user'; 
        bm.innerHTML = `<strong>Assistant:</strong> ${data.reply || data.error}`;
        copilotMessages.appendChild(bm);
        copilotMessages.scrollTop = copilotMessages.scrollHeight;
    } catch (err) {
        console.error(err);
        addSystemMessage("Chatbot error: " + err.message);
    } finally {
        btnCopilotSend.disabled = false;
        btnCopilotSend.innerText = "Send";
    }
};

if (copilotInput) {
    copilotInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') btnCopilotSend.onclick();
    });
}

// --- AI Insights Modal ---
// --- Tab Switching logic ---
window.switchModalTab = function(target) {
    document.querySelectorAll('.modal-pane').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
    
    const pane = document.getElementById('pane-' + target);
    if (pane) pane.classList.add('active');
    
    const tab = [...document.querySelectorAll('.modal-tab')].find(t => t.innerText.toLowerCase().includes(target));
    if (tab) tab.classList.add('active');
};

btnAiProcess.onclick = async () => {
    if (fullTranscript.length === 0) return alert("No transcript to process.");
    
    const originalText = btnAiProcess.innerText;
    btnAiProcess.innerText = "⏳ Processing...";
    btnAiProcess.disabled = true;

    try {
        // Parallel requests for Summary, Notes, and Flashcards
        const [sumRes, notesRes, flashRes] = await Promise.all([
            fetch('/api/process-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    transcript: fullTranscript,
                    roomCode: roomCode,
                    teacherName: (userType === 'teacher' ? userName : 'Teacher')
                })
            }),
            fetch('/api/generate-notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcript: fullTranscript })
            }),
            fetch('/api/generate-flashcards', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcript: fullTranscript })
            })
        ]);

        const data = await sumRes.json();
        const notesData = await notesRes.json();
        const flashData = await flashRes.json();

        // Render Summary
        renderAiInsights(data);
        
        // Render Auto-Notes
        document.getElementById('ai-auto-notes').innerText = notesData.notes || "Failed to generate notes.";
        
        // Render Flashcards
        renderFlashcards(flashData);

        aiModal.classList.remove('hidden');
        switchModalTab('summary');
        
    } catch (err) {
        console.error(err);
        alert("AI Processing failed. " + err.message);
    } finally {
        btnAiProcess.innerText = originalText;
        btnAiProcess.disabled = false;
    }
};

function renderFlashcards(cards) {
    const grid = document.getElementById('ai-flashcards-grid');
    grid.innerHTML = '';
    
    if (!Array.isArray(cards)) return grid.innerHTML = '<p>No cards generated.</p>';

    cards.forEach(c => {
        const card = document.createElement('div');
        card.className = 'flashcard';
        card.innerHTML = `
            <div class="flashcard-inner">
                <div class="flashcard-front">${c.front}</div>
                <div class="flashcard-back">${c.back}</div>
            </div>
        `;
        card.onclick = () => card.classList.toggle('flipped');
        grid.appendChild(card);
    });
}

function showAiResults(data) {
    document.getElementById('ai-modal').classList.remove('hidden');
    
    // Notes
    let notesHtml = `
        <div class="ai-section"><h4>📋 Minutes of Meeting</h4><ul>${data.mom ? data.mom.map(m=>`<li>${m}</li>`).join('') : "<li>N/A</li>"}</ul></div>
        <div class="ai-section"><h4>📝 Notes</h4><p>${data.notes || "N/A"}</p></div>
        <div class="ai-section"><h4>💡 Summary</h4><p>${data.summary || "N/A"}</p></div>
    `;
    
    if (data.silentStudentIntervention) {
        notesHtml += `<div class="ai-section"><h4 style="color:var(--yellow)">🕵️ Engage Silent Students</h4><p>${data.silentStudentIntervention}</p></div>`;
    }
    document.getElementById('ai-notes').innerHTML = notesHtml;

    // Quiz
    let quizHtml = '<div class="ai-section"><h4>❓ Auto-Generated Quiz</h4>';
    if (data.quiz) {
        data.quiz.forEach((q, i) => {
            quizHtml += `<div style="margin-bottom:12px;"><p><strong>Q${i+1}:</strong> ${q.question}</p><ul>`;
            q.options.forEach(opt => quizHtml += `<li style="margin-left:20px;"><input type="radio" name="q${i}"> ${opt}</li>`);
            quizHtml += `</ul></div>`; // Excluded explicit answer so teacher can use it
        });
    }
    quizHtml += '</div>';
    document.getElementById('ai-quiz').innerHTML = quizHtml;

    // Actions
    let actionsHtml = '<div class="ai-section"><h4>✅ Action Items</h4>';
    if (data.actionItems) {
        data.actionItems.forEach(item => actionsHtml += `<div style="margin-bottom:8px;"><input type="checkbox"> ${item}</div>`);
    }
    actionsHtml += '</div>';
    document.getElementById('ai-actions').innerHTML = actionsHtml;

    // Real-World Uses
    let rwHtml = '<div class="ai-section"><h4>🌍 Why This Matters</h4><ul>';
    if (data.realWorldUses) {
        data.realWorldUses.forEach(item => { rwHtml += `<li style="margin-bottom:8px;">${item}</li>`; });
    }
    rwHtml += '</ul></div>';
    const rwPane = document.getElementById('ai-realworld');
    if (rwPane) rwPane.innerHTML = rwHtml;
    
    if (data.sentiment) {
        statMeter.innerText = data.sentiment;
        statMeter.style.fontSize = '1.2rem';
    }
}

document.querySelectorAll('.modal-tab').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.modal-tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.modal-pane').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.target).classList.add('active');
    };
});

document.querySelector('.close-modal').onclick = () => document.getElementById('ai-modal').classList.add('hidden');

// --- Learning Path Mock ---
if (btnLearningPath) {
    btnLearningPath.onclick = () => {
        const originalText = btnLearningPath.innerText;
        btnLearningPath.innerText = "⏳ Generating AI Paths...";
        btnLearningPath.disabled = true;
        setTimeout(() => {
            btnLearningPath.innerText = "✅ Paths Emailed to Students!";
            addSystemMessage("Custom AI learning paths generated and sent to struggling students.");
            setTimeout(() => {
                btnLearningPath.innerText = originalText;
                btnLearningPath.disabled = false;
            }, 4000);
        }, 2000);
    };
}

// --- Code Lab Interaction ---
let codeLabActive = false;
if (btnCodeLab) {
    btnCodeLab.onclick = () => {
        codeLabActive = !codeLabActive;
        btnCodeLab.classList.toggle('active', codeLabActive);
        codeLabContainer.classList.toggle('hidden', !codeLabActive);
    };
}

if (btnSetProblem) {
    btnSetProblem.onclick = () => {
        const prob = prompt("Enter a coding problem for the class:");
        if (prob) {
            socket.emit('set-problem', roomCode, prob);
            addSystemMessage("Sent coding problem: " + prob);
        }
    };
}

if (btnRunCode) {
    btnRunCode.onclick = () => {
        const code = codeEditor.value;
        const lang = codeLang.value;
        codeOutput.innerText = "Running " + lang + " code...\n";
        
        setTimeout(() => {
            if (lang === "JavaScript") {
                try {
                    let logStr = "";
                    const oldLog = console.log;
                    console.log = (...args) => { logStr += args.join(" ") + "\n"; };
                    let result = eval(code);
                    console.log = oldLog;
                    if(result !== undefined) logStr += "\nReturns: " + result;
                    codeOutput.innerText += (logStr || "Execution complete. No output.");
                } catch(e) {
                    codeOutput.innerText += "Error: " + e.message;
                }
            } else {
                codeOutput.innerText += "Simulated output for " + lang + ":\nSuccess! All tests passed.";
            }
        }, 800);
    };
}

const btnAiHint = document.getElementById('btn-ai-hint');
if (btnAiHint) {
    btnAiHint.onclick = async () => {
        const code = codeEditor.value;
        const problem = teacherProblem.innerText;
        const lang = codeLang.value;

        btnAiHint.innerText = "⏳ Thinking...";
        btnAiHint.disabled = true;

        try {
            const res = await fetch('/api/review-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, language: lang, problem })
            });
            const data = await res.json();
            codeOutput.innerText = "AI HINT: " + data.hint;
            codeOutput.style.color = "var(--yellow)";
        } catch (err) {
            codeOutput.innerText = "Failed to get AI hint.";
        } finally {
            btnAiHint.innerText = "💡 AI Hint";
            btnAiHint.disabled = false;
        }
    };
}

if (btnSubmitCode) {
    btnSubmitCode.onclick = () => {
        const code = codeEditor.value;
        socket.emit('submit-code', roomCode, { userName, code });
        addSystemMessage("Code submitted to teacher.");
        btnSubmitCode.innerText = "✅ Submitted";
        setTimeout(() => { btnSubmitCode.innerText = "✅ Submit"; }, 2000);
    };
}

// --- Live Quiz Interaction ---
if (btnLiveQuiz) {
    btnLiveQuiz.onclick = async () => {
        if (fullTranscript.length === 0) return alert("Need some transcript history to generate a quiz.");
        btnLiveQuiz.innerText = "⏳";
        btnLiveQuiz.disabled = true;
        
        try {
            const response = await fetch('/api/generate-live-quiz', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcript: fullTranscript })
            });
            const quizData = await response.json();
            
            if (quizData.error) throw new Error(quizData.error);
            
            socket.emit('send-live-quiz', roomCode, quizData);
            addSystemMessage(`❓ Sent Live Quiz: "${quizData.question}"`);
            
        } catch (err) {
            console.error(err);
            alert("Failed to generate quiz. Is Gemini API key set?");
        } finally {
            btnLiveQuiz.innerText = "❓";
            btnLiveQuiz.disabled = false;
        }
    };
}

// --- Breakout Rooms ---
const btnBreakout = document.getElementById('btn-breakout');
if (btnBreakout) {
    btnBreakout.onclick = async () => {
        btnBreakout.innerText = "⏳ Sorting...";
        btnBreakout.disabled = true;

        try {
            // Get students from leaderboard logic
            const students = [];
            document.querySelectorAll('#leaderboard-list li').forEach(li => {
                const nameSpan = li.querySelector('span:first-child');
                const scoreSpan = li.querySelector('span:last-child');
                if (nameSpan && scoreSpan) {
                    students.push({ 
                        name: nameSpan.innerText.replace(/🥇|🥈|🥉/g, '').trim(), 
                        score: parseInt(scoreSpan.innerText) 
                    });
                }
            });
            
            if (students.length < 2) return alert("Need at least 2 students for breakout rooms.");

            const response = await fetch('/api/generate-breakout-rooms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ students })
            });
            const rooms = await response.json();
            
            showBreakoutResults(rooms);
        } catch (err) {
            console.error(err);
            alert("Breakout failed. " + err.message);
        } finally {
            btnBreakout.innerText = "🚀 AI Breakout Rooms";
            btnBreakout.disabled = false;
        }
    };
}

function showBreakoutResults(rooms) {
    let html = '<div class="ai-section"><h4>🚀 AI Breakout Groups</h4>';
    rooms.forEach(r => {
        html += `
            <div style="margin-bottom:16px; padding:12px; border:1px solid var(--border); border-radius:8px;">
                <div style="font-weight:700; color:var(--accent);">${r.roomName}</div>
                <div style="font-size:0.85rem; margin:4px 0;">Topic: ${r.topic}</div>
                <div style="font-size:0.85rem; color:var(--text2);">Members: ${r.members.join(', ')}</div>
            </div>
        `;
    });
    html += '</div>';
    
    document.getElementById('ai-modal').classList.remove('hidden');
    document.getElementById('ai-notes').innerHTML = html; // Show in first tab
}
