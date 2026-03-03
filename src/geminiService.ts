import { GoogleGenAI, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function getStudyBuddyResponse(prompt: string, history: { role: string, parts: { text: string }[] }[], context?: { materials: any[], queries: any[] }) {
  const model = "gemini-3.1-pro-preview";
  
  let academicContext = "";
  if (context) {
    if (context.materials.length > 0) {
      academicContext += "\n\nAVAILABLE ACADEMIC MATERIALS:\n" + context.materials.map(m => `- [${m.type.toUpperCase()}] ${m.title}: ${m.content} (Subject: ${m.subject}, Due: ${m.due_date || 'N/A'})`).join('\n');
    }
    if (context.queries.length > 0) {
      academicContext += "\n\nRECENT DISCUSSION QUERIES:\n" + context.queries.map(q => `- ${q.subject}: ${q.content}`).join('\n');
    }
  }

  const chat = ai.chats.create({
    model,
    config: {
      systemInstruction: `You are StudyBuddy AI, a helpful, encouraging, and highly intelligent tutor for TGH Campus. You specialize in Grade 8-10 curriculum but can help with anything. Keep your tone 'Cyber-Luxury' - professional, sharp, and futuristic. ${academicContext ? `\n\nYou have access to the following campus academic context to help the student better: ${academicContext}` : ""}`,
    },
    history
  });

  const result = await chat.sendMessage({ message: prompt });
  return result.text;
}

export async function analyzeImage(base64Image: string, prompt: string) {
  const model = "gemini-3.1-pro-preview";
  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        { inlineData: { data: base64Image.split(',')[1], mimeType: "image/png" } },
        { text: prompt }
      ]
    }
  });
  return response.text;
}

export async function generateSpeech(text: string) {
  const model = "gemini-2.5-flash-preview-tts";
  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Zephyr' },
        },
      },
    },
  });

  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
}
