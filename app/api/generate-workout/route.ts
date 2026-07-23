import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI({});

export async function POST(req: Request) {
  try {
    const { student, objective, split, days, needs, durationWeeks, weight, height, imc, clinicalNotes, previousWorkouts, exerciseCatalog, anamnesis } = await req.json();

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
    
    FICHA DE ANAMNESE E SAÚDE DO ALUNO (INTEGRAÇÃO CLÍNICA):
    ${anamnesis ? `
    • Restrições Médicas/Lesões: ${anamnesis.medical_restrictions || 'Nenhuma'}
    • Histórico Cirúrgico: ${anamnesis.surgical_history || 'Nenhum'}
    • Condição Cardiovascular: ${anamnesis.cardio_condition || 'Normal'}
    • Medicamentos em Uso: ${anamnesis.medications || 'Nenhum'}
    • Hábitos Alimentares/Alergias: ${anamnesis.dietary_habits || 'Não informado'}
    • Consumo Diário de Água: ${anamnesis.water_intake ? `${anamnesis.water_intake} litros` : 'Não informado'}
    • Nível de Flexibilidade: ${anamnesis.flexibility_level || 'Médio'}
    ` : 'Não cadastrada'}
    
    ${previousWorkouts && previousWorkouts.length > 0 ? `HISTÓRICO RECENTE (Evite repetir os exercícios principais da mesma forma para não gerar platô):\n${JSON.stringify(previousWorkouts)}` : ''}
    
    ${exerciseCatalog && exerciseCatalog.length > 0 ? `CATÁLOGO DE EXERCÍCIOS DISPONÍVEIS NA SUA BIBLIOTECA (Selecione exercícios deste catálogo preferencialmente para montar o treino. Se necessário, você pode sugerir outros fora dele, mas dê prioridade a estes):\n- ${exerciseCatalog.join('\n- ')}` : ''}

    DIRETRIZES CLÍNICAS E DE SEGURANÇA OBRIGATÓRIAS (AI CLINICAL GUARD):
    Se houver observações clínicas (limitações, dores relatadas) ou qualquer alteração na ficha de anamnese, você deve seguir rigidamente estas regras na seleção dos exercícios:
    1. JOELHO / CONDROMALÁCIA / PATELA: Evite agachamento profundo clássico, cadeira extensora pesada com grande amplitude de extensão, passadas/avanços profundos. Prefira variações como leg press com amplitude controlada, agachamento búlgaro controlado, flexora em pé/deitada, ou exercícios isométricos. Adicione notas de precaução.
    2. LOMBAR / HÉRNIA DE DISCO / COLUNA: Evite compressão axial pesada. Não prescreva Levantamento Terra clássico, Agachamento Livre com Barra Pesada, ou Remada Curvada livre. Prefira variações suportadas (Remada Cavalinho com apoio no peito, Leg Press baixo com lombar bem apoiada, prancha abdominal estática).
    3. OMBRO / MANGUITO ROTADOR: Evite Desenvolvimento por trás da nuca, Remada Alta pegada fechada, ou supino inclinado livre muito profundo. Prefira desenvolvimento no plano da escápula (neutro), supino com halteres pegada neutra e adicione manguito rotador em polia (rotação externa/interna) nas observações de aquecimento.
    4. CARDÍACO / MEDICAMENTOS / HIPERTENSÃO: Se o aluno tiver histórico cardíaco, cirúrgico ou fizer uso de medicamentos reguladores (como beta-bloqueadores), reduza a intensidade de exercícios de altíssima exigência cardiovascular de forma abrupta, e evite manobra de Valsalva excessiva. Indique pausas ligeiramente maiores ou foco em controle cardiorrespiratório.
    5. FLEXIBILIDADE: Adapte a amplitude de movimento recomendada nos treinos com base no nível de flexibilidade do aluno (ex: para nível 'Baixo', recomende amplitudes controladas e exercícios de alongamento específicos nas observações dos exercícios).
    
    Analise criteriosamente as observações clínicas e a ficha de anamnese listadas para sugerir um treino 100% seguro e adaptado para a saúde e articulações do aluno.`;

    let workoutJson: any = null;

    // 1. Tentar geração via DeepSeek API (se DEEPSEEK_API_KEY estiver configurada)
    if (process.env.DEEPSEEK_API_KEY) {
      try {
        const dsRes = await fetch("https://api.deepseek.com/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [
              {
                role: "system",
                content: "Você é um especialista em fisiologia do exercício e treinador de alto rendimento. Responda APENAS com um JSON estritamente válido segundo o schema solicitado, sem marcações markdown ```json."
              },
              {
                role: "user",
                content: prompt
              }
            ],
            response_format: { type: "json_object" },
            temperature: 0.3
          })
        });

        if (dsRes.ok) {
          const dsData = await dsRes.json();
          let rawText = dsData?.choices?.[0]?.message?.content || "";
          rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
          if (rawText) {
            workoutJson = JSON.parse(rawText);
          }
        } else {
          console.warn("DeepSeek API respondeu com status:", dsRes.status, await dsRes.text());
        }
      } catch (dsErr) {
        console.warn("DeepSeek API falhou, acionando fallback Gemini:", dsErr);
      }
    }

    // 2. Fallback para Google Gemini caso DeepSeek não retorne resultado
    if (!workoutJson) {
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
        const errMsg = err.message || "";
        const isApiKeyError = err.status === 403 || errMsg.includes("403") || errMsg.toLowerCase().includes("permission_denied") || errMsg.toLowerCase().includes("api key") || errMsg.toLowerCase().includes("leaked");
        
        if (isApiKeyError) {
          return NextResponse.json({ 
            error: "Sua chave de API do Gemini (GEMINI_API_KEY) está inválida ou bloqueada (Erro 403). Configure uma nova chave no painel." 
          }, { status: 403 });
        }
        
        console.warn("gemini-2.5-flash falhou, tentando fallback gemini-2.5-flash-lite:", errMsg);
        try {
          response = await ai.models.generateContent({
            model: "gemini-2.5-flash-lite",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
            }
          });
        } catch (fallbackErr: any) {
          console.error("Fallback Gemini também falhou:", fallbackErr);
          return NextResponse.json({ 
            error: `Erro ao gerar protocolo (IA): ${fallbackErr.message || fallbackErr}` 
          }, { status: 500 });
        }
      }

      const text = response?.text;
      if (!text) throw new Error("Falha ao gerar treino pela IA");
      workoutJson = JSON.parse(text);
    }

    return NextResponse.json(workoutJson);
  } catch (error: any) {
    console.error("Erro no gerador de treinos com IA:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
