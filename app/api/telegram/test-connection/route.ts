import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ error: 'Token do bot é obrigatório.' }, { status: 400 });
    }

    // Chamada oficial à API do Telegram para obter dados do Bot
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await res.json();

    if (data.ok) {
      return NextResponse.json({ success: true, bot: data.result });
    } else {
      return NextResponse.json({ error: data.description || 'Falha ao conectar com o Telegram.' }, { status: 400 });
    }
  } catch (err: any) {
    console.error('Error testing Telegram bot connection:', err);
    return NextResponse.json({ error: err.message || 'Erro interno do servidor.' }, { status: 500 });
  }
}
