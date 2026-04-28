import express from 'express';
import mongoose from 'mongoose';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { GoogleGenerativeAI } from '@google/generative-ai';
import jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from './db.js';
import User from './models/User.js';
import Session from './models/Session.js';

dotenv.config();

// Connect to Database
connectDB();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
    }
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

app.use(express.json());
app.use(express.static(path.join(__dirname, '../'))); // Serve project root

// --- Mock DB for Offline Mode ---
const mockUsers = [];
const isDbConnected = () => mongoose.connection.readyState === 1;

// --- Auth Routes ---

// Register
app.post('/api/auth/register', async (req, res) => {
    const { name, email, password, role, phone } = req.body;
    try {
        if (!mongoose.connection.readyState) {
            // Mock Registration
            if (mockUsers.find(u => u.email === email)) return res.status(400).json({ error: "User already exists (Mock Mode)" });
            const mockUser = { _id: Date.now().toString(), name, email, password, role, phone, xp: 0, badges: [] };
            mockUsers.push(mockUser);
            return res.status(201).json({ ...mockUser, token: 'mock-token' });
        }

        const userExists = await User.findOne({ email });
        if (userExists) return res.status(400).json({ error: "User already exists" });

        const user = await User.create({ name, email, password, role, phone });
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '30d' });

        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            token
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        if (!mongoose.connection.readyState) {
            // Mock Login
            const user = mockUsers.find(u => u.email === email && u.password === password);
            if (user) return res.json({ ...user, token: 'mock-token' });
            return res.status(401).json({ error: "Invalid email or password (Mock Mode)" });
        }

        const user = await User.findOne({ email });
        if (user && (await user.matchPassword(password))) {
            const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '30d' });
            res.json({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                token
            });
        } else {
            res.status(401).json({ error: "Invalid email or password" });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// AI Processing Endpoint
app.post('/api/process-session', async (req, res) => {
    const { transcript } = req.body;
    
    if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Gemini API Key not configured on server." });
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

        const prompt = `
            You are an advanced educational AI assistant. Based on the following classroom transcript, generate a comprehensive analysis in JSON format.
            
            Include these sections:
            1. "mom": Minutes of Meeting (Detailed points discussed).
            2. "notes": Educational concept notes explaining the key topics.
            3. "summary": A 3-sentence flash summary.
            4. "actionItems": An array of strings representing homework, tasks, or follow-ups mentioned.
            5. "quiz": An array of 3 multiple-choice questions based on the content. Each question should be an object with "question", "options" (array of 4 strings), and "answer" (the correct string).
            6. "sentiment": A string describing the overall class sentiment (e.g., "Highly Engaged", "Confused", "Neutral", "Curious").
            7. "realWorldUses": An array of 3 strings explaining "Why This Matters" (real-world applications and job relevance of the topic).
            8. "silentStudentIntervention": A string suggesting a specific ice-breaker or question the teacher can ask to engage quiet students on this topic.

            Transcript:
            ${JSON.stringify(transcript)}

            Return ONLY valid JSON.

        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        // Basic JSON cleaning if Gemini adds markdown backticks
        const cleanJson = text.replace(/```json|```/g, '').trim();
        const insights = JSON.parse(cleanJson);

        // Save to Database
        try {
            const { roomCode, teacherName } = req.body; 
            const newSession = new Session({
                roomCode: roomCode || "TEMP-ROOM",
                teacherName: teacherName || "Unknown Teacher",
                transcript: transcript,
                aiInsights: insights
            });
            await newSession.save();
            console.log("Session saved to DB");
        } catch (dbErr) {
            console.error("DB Save Error:", dbErr);
        }

        res.json(insights);
    } catch (error) {
        console.error("Gemini Error:", error);
        res.status(500).json({ error: "Failed to process transcript with AI." });
    }
});

// Teacher Copilot Endpoint
app.post('/api/copilot', async (req, res) => {
    const { transcript, query } = req.body;
    
    if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Gemini API Key not configured." });
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
        
        // --- NEW: Search Database for Historical Context ---
        let historicalContext = "";
        try {
            // Find the last 5 sessions for this teacher (or general)
            const pastSessions = await Session.find({}).sort({ createdAt: -1 }).limit(5);
            historicalContext = pastSessions.map(s => 
                `Session on ${s.createdAt.toDateString()}: ${s.aiInsights.summary}`
            ).join('\n');
        } catch (dbErr) {
            console.log("Historical search skipped (DB offline).");
        }

        const contextText = transcript.map(t => `${t.user}: ${t.text}`).join('\n');
        
        const prompt = `
            You are a "Teacher Copilot" assisting a teacher.
            
            HISTORICAL CONTEXT (Past Classes):
            ${historicalContext || "No previous session data found."}

            LIVE CLASS TRANSCRIPT:
            ${contextText}
            
            The teacher asks you: "${query}"
            
            If the teacher asks about previous classes, use the HISTORICAL CONTEXT. 
            If they ask about the current class, use the LIVE CLASS TRANSCRIPT.
            Answer concisely.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        res.json({ reply: response.text() });
    } catch (error) {
        console.error("Copilot Error:", error);
        res.status(500).json({ 
            error: "Copilot failed.", 
            details: "Please ensure your GEMINI_API_KEY is correctly set in the .env file. Get one at aistudio.google.com." 
        });
    }
});

// Live Quiz Generation
app.post('/api/generate-live-quiz', async (req, res) => {
    const { transcript } = req.body;
    
    if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Gemini API Key not configured." });
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
        
        const prompt = `
            You are an AI teacher. Based on the following live classroom transcript, generate ONE multiple-choice pop quiz question to test the students' understanding.
            Return ONLY a valid JSON object with the following format:
            {
                "question": "The question text",
                "options": ["Option A", "Option B", "Option C", "Option D"],
                "answer": "The exact string of the correct option"
            }

            Transcript:
            ${JSON.stringify(transcript.slice(-30))}
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        const cleanJson = text.replace(/```json|```/g, '').trim();
        
        res.json(JSON.parse(cleanJson));
    } catch (error) {
        console.error("Live Quiz Error:", error);
        res.status(500).json({ error: "Failed to generate live quiz." });
    }
});

// AI Breakout Room Generator
app.post('/api/generate-breakout-rooms', async (req, res) => {
    const { students } = req.body; // Array of { name, score }
    
    if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Gemini API Key not configured." });
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
        
        const prompt = `
            You are an educational strategist. I have a list of students and their current understanding scores:
            ${JSON.stringify(students)}
            
            Please group them into "Breakout Rooms" (3-4 students each). 
            Strategy: Match "High Score" students with "Low Score" students to encourage peer learning.
            
            Return ONLY a valid JSON array of objects:
            [
                { "roomName": "Room 1", "members": ["Name A", "Name B", "Name C"], "topic": "Focus on Topic X" },
                ...
            ]
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        const cleanJson = text.replace(/```json|```/g, '').trim();
        
        res.json(JSON.parse(cleanJson));
    } catch (error) {
        console.error("Breakout Error:", error);
        res.status(500).json({ error: "Failed to generate breakout rooms." });
    }
});

// AI Auto-Note Generator
app.post('/api/generate-notes', async (req, res) => {
    const { transcript } = req.body;
    if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: "API Key missing." });

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
        const contextText = transcript.map(t => `${t.user}: ${t.text}`).join('\n');
        
        const prompt = `
            Transform the following classroom transcript into beautiful, professional Markdown study notes.
            Use H1 for the main topic, H2 for subtopics, bullet points for details, and code blocks if any code was mentioned.
            
            TRANSCRIPT:
            ${contextText}
            
            RETURN ONLY THE MARKDOWN CONTENT.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        res.json({ notes: response.text() });
    } catch (error) {
        console.error("Notes Error:", error);
        res.status(500).json({ error: "Failed to generate notes." });
    }
});

// AI Flashcards Generator
app.post('/api/generate-flashcards', async (req, res) => {
    const { transcript } = req.body;
    if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: "API Key missing." });

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
        const contextText = transcript.map(t => `${t.user}: ${t.text}`).join('\n');
        
        const prompt = `
            Based on this classroom transcript, generate 5 key study flashcards.
            Return ONLY a valid JSON array of objects:
            [
                { "front": "Question/Term", "back": "Answer/Definition" },
                ...
            ]
            
            TRANSCRIPT:
            ${contextText}
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        const cleanJson = text.replace(/```json|```/g, '').trim();
        res.json(JSON.parse(cleanJson));
    } catch (error) {
        console.error("Flashcards Error:", error);
        res.status(500).json({ error: "Failed to generate flashcards." });
    }
});

// Real-time Coordination
const roomData = {}; // Store leaderboard points per room

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-room', (roomId, userId) => {
        socket.join(roomId);
        console.log(`User ${userId} joined room ${roomId}`);
        
        if (!roomData[roomId]) {
            roomData[roomId] = { leaderboard: {} };
        }
        if (userId && userId !== 'Anonymous Student' && userId !== 'Teacher') {
            roomData[roomId].leaderboard[userId] = roomData[roomId].leaderboard[userId] || 0;
        }

        socket.to(roomId).emit('user-joined', userId);
        io.to(roomId).emit('leaderboard-update', roomData[roomId].leaderboard);
    });


    socket.on('signal', (data) => {
        io.to(data.to).emit('signal', {
            from: socket.id,
            signal: data.signal
        });
    });

    // --- New Live Features ---
    socket.on('focus-lost', (roomId, userName) => {
        socket.to(roomId).emit('student-focus-lost', userName);
    });
    
    socket.on('focus-gained', (roomId, userName) => {
        socket.to(roomId).emit('student-focus-gained', userName);
    });

    socket.on('trigger-pulse', (roomId) => {
        socket.to(roomId).emit('receive-pulse');
    });

    socket.on('answer-pulse', (roomId, score) => {
        socket.to(roomId).emit('pulse-result', score);
    });

    socket.on('send-chat', (roomId, messageData) => {
        socket.to(roomId).emit('receive-chat', messageData);
    });

    // 4. Gamified Leaderboard
    socket.on('add-points', (roomId, userName, points) => {
        if (roomData[roomId] && userName) {
            roomData[roomId].leaderboard[userName] = (roomData[roomId].leaderboard[userName] || 0) + points;
            io.to(roomId).emit('leaderboard-update', roomData[roomId].leaderboard);
        }
    });

    // 5. Thinking-Based Assignment
    socket.on('send-assignment', (roomId, question) => {
        socket.to(roomId).emit('receive-assignment', question);
    });

    socket.on('submit-assignment', (roomId, data) => {
        socket.to(roomId).emit('assignment-submitted', data); // teacher receives submission
    });

    // 6. Code / Problem Lab
    socket.on('set-problem', (roomId, problem) => {
        socket.to(roomId).emit('receive-problem', problem);
    });

    socket.on('submit-code', (roomId, data) => {
        socket.to(roomId).emit('code-submitted', data); // teacher receives code
        // Award points for submitting code
        if (roomData[roomId] && data.userName) {
            roomData[roomId].leaderboard[data.userName] = (roomData[roomId].leaderboard[data.userName] || 0) + 15;
            io.to(roomId).emit('leaderboard-update', roomData[roomId].leaderboard);
        }
    });

    // 7. Live Quiz
    socket.on('send-live-quiz', (roomId, quizData) => {
        socket.to(roomId).emit('receive-live-quiz', quizData);
    });
    
    socket.on('submit-quiz-answer', (roomId, userName, isCorrect) => {
        if (isCorrect) {
            if (roomData[roomId] && userName) {
                roomData[roomId].leaderboard[userName] = (roomData[roomId].leaderboard[userName] || 0) + 10;
                io.to(roomId).emit('leaderboard-update', roomData[roomId].leaderboard);
            }
        }
        socket.to(roomId).emit('quiz-answered', { userName, isCorrect });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// Award Points & XP
app.post('/api/auth/award-points', async (req, res) => {
    const { email, points } = req.body;
    try {
        if (!mongoose.connection.readyState) {
            // Mock XP Sync
            const user = mockUsers.find(u => u.email === email);
            if (!user) return res.status(404).json({ error: "User not found (Mock Mode)" });
            user.xp = (user.xp || 0) + (points * 10);
            if (user.xp >= 1000 && !user.badges.includes('Quick Thinker')) user.badges.push('Quick Thinker');
            return res.json({ xp: user.xp, badges: user.badges });
        }

        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ error: "User not found" });

        user.totalPoints += points;
        user.xp += points * 10; // 10 XP per point

        // Check for new badges
        if (user.xp >= 1000 && !user.badges.includes('Quick Thinker')) user.badges.push('Quick Thinker');
        if (user.totalPoints >= 500 && !user.badges.includes('Problem Solver')) user.badges.push('Problem Solver');

        await user.save();
        res.json({ points: user.totalPoints, xp: user.xp, badges: user.badges });
    } catch (error) {
        res.status(500).json({ error: "Failed to award points" });
    }
});

// AI Code Reviewer
app.post('/api/review-code', async (req, res) => {
    const { code, language, problem } = req.body;
    if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: "API Key missing." });

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
        const prompt = `
            You are a senior developer. Review this student's code:
            PROBLEM: ${problem || "General Programming"}
            LANGUAGE: ${language}
            CODE: 
            ${code}
            
            Provide a short, encouraging hint or performance tip. DO NOT give the full answer. 
            Keep it under 3 sentences.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        res.json({ hint: response.text() });
    } catch (error) {
        console.error("Code Review Error:", error);
        res.status(500).json({ error: "Failed to review code." });
    }
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
