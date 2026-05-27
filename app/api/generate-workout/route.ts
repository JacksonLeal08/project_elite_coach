import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI({});

export async function POST(req: Request) {
  try {
    const { student, objective, split, days, needs, durationWeeks } = await req.json();

    const prompt = `Gere um protocolo de treino personalizado.
    Retorne APENAS um objeto JSON válido (sem \`\`\`json) com esta estrutura:
    {
      "days": [
        {
          "dayName": "Nome do dia",
          "exercises": [
            { "name": "Nome", "sets": "4", "reps": "10-12", "rest": "60s", "notes": "" }
          ]
        }
      ]
    }
    Aluno: ${student} | Divisão: ${split} | Dias: ${days} | Semanas: ${durationWeeks}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = response.text;
    if (!text) throw new Error("Falha ao gerar treino");

    return NextResponse.json(JSON.parse(text));
  } catch (error: any) {
    console.error("Gemini erro:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
