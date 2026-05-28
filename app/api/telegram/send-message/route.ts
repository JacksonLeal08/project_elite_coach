import { NextResponse } from 'next/server';
import { supabase } from '../../../utils/supabase';

export async function POST(req: Request) {
  try {
    const { chatId, message } = await req.json();

    if (!chatId || !message) {
      return NextResponse.json({ error: 'Chat ID e mensagem são obrigatórios.' }, { status: 400 });
    }

    // Buscar o token ativo do bot nas configurações do sistema no Supabase
    const { data: setting, error: fetchError } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'telegram_bot_token')
      .maybeSingle();

    if (fetchError || !setting?.value) {
      return NextResponse.json({ error: 'Token do Telegram não configurado nas Configurações.' }, { status: 400 });
    }

    const token = setting.value;

    // Disparar requisição para a API oficial do Telegram
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      })
    });

    const result = await res.json();

    if (result.ok) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: result.description || 'Falha ao enviar mensagem.' }, { status: 400 });
    }
  } catch (err: any) {
    console.error('Error sending Telegram message:', err);
    return NextResponse.json({ error: err.message || 'Erro interno do servidor.' }, { status: 500 });
  }
}
