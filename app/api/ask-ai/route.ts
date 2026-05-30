import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI({});

export async function POST(req: Request) {
  try {
    const { question, topic, subtopic } = await req.json();

    const systemPrompt = `Você é o Agente de IA 24h do sistema Elite Coach CRM.
Sua função é sanar dúvidas do usuário sobre as funcionalidades, campos e modalidades do sistema.

ESTRUTURA E REGRAS DO SISTEMA:
1. Painel Geral & Financeiro: Permite gerenciar as informações básicas, badges (conquistas), contatos (WhatsApp/Telegram) e faturas financeiras dos alunos. Faturas em atraso exibem sinalizador de alerta animado (pulse) na cor vermelha.
2. Anamnese & Avaliação Postural: Ficha clínica contendo restrições médicas, histórico cirúrgico, medicações, hábitos alimentares, consumo de água e flexibilidade. Avaliação postural com grade geométrica calibrável (eixo horizontal de prumo e controle de opacidade) para analisar fotos nos ângulos de Frente, Costas e Perfil.
3. Metas & Evolução Corporal: Define metas de Peso, % de Gordura e Massa Muscular, comparando com as avaliações no painel e nos gráficos. Permite exportar PDFs de Laudos e gerar um Link de Consulta Pública com share_token para o aluno ver no celular sem login.
4. Agenda de Retorno: Agendamento interativo com três status: Pendente (solicitado pelo aluno), Sugerido (coach sugere data/hora) e Confirmado (aceito por ambos).
5. Assiduidade e Treinos: Acompanha a assiduidade semanal e histórico de check-ins de treinos concluídos pelo aluno.
6. Criação de Treinos (IA): Utiliza o "AI Clinical Guard" que analisa a anamnese do aluno e impede a prescrição de exercícios prejudiciais para lesões relatadas (ex: agachamento profundo para condromalácia patelar, levantamento terra para hérnia discal).
7. PWA / Offline: O portal do aluno suporta acesso offline completo servindo arquivos do cache e sincronizando as ações do aluno quando a internet retorna.

INSTRUÇÕES:
- Responda de forma extremamente clara, premium e em português (pt-BR).
- Explique de forma didática baseando-se no tópico informado: ${topic || 'Geral'} e subtópico: ${subtopic || 'Geral'}.
- Mantenha a resposta concisa, focada e útil para o usuário.

PERGUNTA DO USUÁRIO:
${question}`;

    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: systemPrompt
      });
    } catch (err: any) {
      console.error("Gemini failed in ask-ai route:", err);
      return NextResponse.json({ 
        error: "Serviço de IA indisponível temporariamente. Usando assistente local..." 
      }, { status: 500 });
    }

    const text = response.text;
    return NextResponse.json({ answer: text });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
