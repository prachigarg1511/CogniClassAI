import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
    roomCode: {
        type: String,
        required: true
    },
    teacherName: {
        type: String,
        required: true
    },
    transcript: [{
        user: String,
        text: String,
        timestamp: String,
        isDoubt: Boolean
    }],
    aiInsights: {
        mom: [String],
        notes: String,
        summary: String,
        actionItems: [String],
        quiz: [{
            question: String,
            options: [String],
            answer: String
        }],
        sentiment: String,
        realWorldUses: [String],
        silentStudentIntervention: String
    },
    metrics: {
        avgUnderstanding: Number,
        avgFocus: Number,
        participationRate: Number
    }
}, {
    timestamps: true
});

const Session = mongoose.model('Session', sessionSchema);

export default Session;
