import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI({});

export async function POST(req: Request) {
  try {
    const { student, objective, split, days, needs, durationWeeks, weight, height, imc, clinicalNotes, previousWorkouts } = await req.json();

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
    
    INFORMAÇÕES DO ALUNO:
    Nome: ${student}
    Objetivo: ${objective}
    Peso: ${weight || 'Não informado'} | Altura: ${height || 'Não informado'} | IMC: ${imc || 'Não informado'}
    Divisão de Treino: ${split} | Dias por semana: ${days} | Duração: ${durationWeeks} semanas
    Observações Clínicas/Limitações: ${clinicalNotes || 'Nenhuma'}
    Necessidades/Foco: ${needs || 'Nenhum'}
    
    ${previousWorkouts && previousWorkouts.length > 0 ? `HISTÓRICO RECENTE (Evite repetir os exercícios principais da mesma forma para não gerar platô):\n${JSON.stringify(previousWorkouts)}` : ''}
    
    Analise as informações do aluno, principalmente as observações clínicas (limitações) para sugerir um treino seguro e eficiente.`;

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
