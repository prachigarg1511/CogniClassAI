import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function listModels() {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent("Hello");
    const response = await result.response;
    console.log("Success with gemini-1.5-flash:", response.text());
  } catch (e) {
    console.error("Failed with gemini-1.5-flash:", e.message);
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const result = await model.generateContent("Hello");
        const response = await result.response;
        console.log("Success with gemini-pro:", response.text());
    } catch (e2) {
        console.error("Failed with gemini-pro:", e2.message);
    }
  }
}

listModels();
