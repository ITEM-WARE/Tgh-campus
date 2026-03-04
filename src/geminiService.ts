import { GoogleGenAI, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function getStudyBuddyResponse(prompt: string, history: { role: string, parts: { text: string }[] }[], context?: { materials: any[], queries: any[], user?: any, siteStats?: any }) {
  const model = "gemini-3.1-pro-preview";
  
  let academicContext = "";
  if (context) {
    if (context.materials && context.materials.length > 0) {
      academicContext += "\n\nAVAILABLE ACADEMIC MATERIALS (Homework/Classwork):\n" + context.materials.map(m => `- [${m.type?.toUpperCase() || 'MATERIAL'}] ${m.title}: ${m.content} (Subject: ${m.subject}, Due: ${m.due_date || 'N/A'})`).join('\n');
    }
    if (context.queries && context.queries.length > 0) {
      academicContext += "\n\nRECENT DISCUSSION QUERIES:\n" + context.queries.map(q => `- ${q.subject}: ${q.content}`).join('\n');
    }
    if (context.user) {
      academicContext += `\n\nCURRENT USER PROFILE:\n- Name: ${context.user.display_name}\n- Username: @${context.user.username}\n- Grade: ${context.user.grade}\n- Section: ${context.user.section}\n- House: ${context.user.house || 'N/A'}\n- Level: ${context.user.level}\n- Toins: ${context.user.toins}\n- Prestige: ${context.user.prestige_level || 0}`;
    }
    if (context.siteStats) {
      academicContext += `\n\nSITE STATISTICS:\n- Total Registered Users: ${context.siteStats.totalUsers}\n- User Directory Sample: ${context.siteStats.userSample?.map((u: any) => `${u.display_name} (@${u.username})`).join(', ')}`;
    }
  }

  const chat = ai.chats.create({
    model,
    config: {
      systemInstruction: `You are StudyBuddy AI, the official intelligent assistant for TGH Campus. You are professional, encouraging, and 'Cyber-Luxury' in tone.

CURRICULUM KNOWLEDGE:
- Grades 8-10: Following the IGCSE Cambridge curriculum.
- Grades 11-12: Following the A Levels curriculum.
- You should tailor your academic help based on the user's grade.

SITE FEATURES & SYSTEMS:
1. **Economy (Toins)**: The site's currency. Users earn Toins through academic participation, completing tasks, winning challenges, and redeeming codes.
2. **Profile Store**: Users can buy digital customization items (frames, effects, themes, badges) using Toins.
3. **Redeem Codes**: Admins release codes for Toins or items. Some are hidden in "Treasure Hunt Mode".
4. **Tasks & Challenges**: Standalone system where users can create tasks for others or challenge each other with Toin stakes.
5. **Tickets**: Support system for reporting issues or suggesting features.
6. **Stories**: Users can post temporary visual updates.
7. **Academics**: Section for Homework, Classwork, and Discussion Queries.
8. **Profile System**: Users have levels, XP, prestige, and customizable profiles.

Your goal is to help users with their studies, explain site mechanics, and provide information about the campus community. Use the provided context to give specific answers about homework or other users if asked.`,
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
