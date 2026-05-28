import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI({});

export async function POST(req: Request) {
  try {
    const { student, objective, split, days, needs, durationWeeks, weight, height, imc, clinicalNotes, previousWorkouts } = await req.json();

    const prompt = `Gere um protocolo de treino personalizado de alto rendimento.
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
    
    DIRETRIZES CLÍNICAS E DE SEGURANÇA OBRIGATÓRIAS (AI CLINICAL GUARD):
    Se houver observações clínicas (limitações ou dores relatadas), você deve seguir rigidamente estas regras na seleção dos exercícios:
    1. JOELHO / CONDROMALÁCIA / PATELA: Evite agachamento profundo clássico, cadeira extensora pesada com grande amplitude de extensão, passadas/avanços profundos. Prefira variações como leg press com amplitude controlada, agachamento búlgaro controlado, flexora em pé/deitada, ou exercícios isométricos. Adicione notas de precaução.
    2. LOMBAR / HÉRNIA DE DISCO / COLUNA: Evite compressão axial pesada. Não prescreva Levantamento Terra clássico, Agachamento Livre com Barra Pesada, ou Remada Curvada livre. Prefira variações suportadas (Remada Cavalinho com apoio no peito, Leg Press baixo com lombar bem apoiada, prancha abdominal estática).
    3. OMBRO / MANGUITO ROTADOR: Evite Desenvolvimento por trás da nuca, Remada Alta pegada fechada, ou supino inclinado livre muito profundo. Prefira desenvolvimento no plano da escápula (neutro), supino com halteres pegada neutra e adicione manguito rotador em polia (rotação externa/interna) nas observações de aquecimento.
    
    Analise criteriosamente as observações clínicas listadas para sugerir um treino 100% seguro e adaptado para a saúde e articulações do aluno.`;

    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });
    } catch (err: any) {
      console.warn("gemini-2.5-flash failed or overloaded, trying fallback gemini-1.5-flash. Error:", err.message || err);
      // Fallback model for high availability
      response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });
    }

    const text = response.text;
    if (!text) throw new Error("Falha ao gerar treino");

    return NextResponse.json(JSON.parse(text));
  } catch (error: any) {
    console.error("Gemini erro:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
