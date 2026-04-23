import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { format, addHours, parseISO } from 'date-fns';

export const dynamic = 'force-dynamic';

/**
 * Função para enviar mensagem via WhatsApp Cloud API (Meta)
 * Pode ser adaptada para outros provedores (Twilio, Z-API, Evolution, etc)
 */
async function sendWhatsApp(to: string, message: string) {
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.error('Configurações do WhatsApp ausentes no .env');
    return false;
  }

  // Limpa o número (remove +, -, espaços)
  const cleanTo = to.replace(/\D/g, '');

  try {
    const response = await fetch(
      `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanTo,
          type: 'text',
          text: { 
            preview_url: false,
            body: message 
          },
        }),
      }
    );

    const data = await response.json();
    if (!response.ok) {
        console.error('Erro na API do WhatsApp:', data);
    }
    return response.ok;
  } catch (error) {
    console.error('Erro ao chamar API do WhatsApp:', error);
    return false;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  // Segurança: Verifica o token secreto para evitar disparos maliciosos
  if (secret !== process.env.CRON_SECRET) {
     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  
  // --- 1. Lembretes de 24 Horas ---
  const window24hStart = addHours(now, 23);
  const window24hEnd = addHours(now, 25);

  const supabaseAdmin = getSupabaseAdmin();
  const { data: appts24h, error: error24h } = await supabaseAdmin
    .from('appointments')
    .select('*, clients(nome, whatsapp), user_profile:profiles!appointments_user_id_fkey(whatsapp)')
    .eq('reminder_24h_sent', false)
    .eq('status', 'scheduled')
    .gte('start_time', window24hStart.toISOString())
    .lte('start_time', window24hEnd.toISOString());

  if (error24h) console.error('Erro ao buscar appts 24h:', error24h);

  let sent24h = 0;
  if (appts24h && appts24h.length > 0) {
    for (const app of appts24h) {
      const userWhatsapp = app.user_profile?.whatsapp;
      if (!userWhatsapp) continue;

      const formattedDate = format(parseISO(app.start_time), 'dd/MM/yyyy HH:mm');
      const message = `🔴 *LEMBRETE: 24 HORAS*\n\n📍 *Compromisso:* ${app.title}\n📅 *Data/Hora:* ${formattedDate}\n👤 *Cliente:* ${app.clients?.nome || 'N/A'}\n📍 *Local:* ${app.location || 'Não informado'}\n📝 *Notas:* ${app.description || '-'}\n\n_Mensagem automática do Sistema Imobiliário_`;
      
      const success = await sendWhatsApp(userWhatsapp as string, message);
      if (success) {
        await supabaseAdmin.from('appointments').update({ reminder_24h_sent: true }).eq('id', app.id);
        sent24h++;
      }
    }
  }

  // --- 2. Lembretes de 3 Horas ---
  const window3hStart = addHours(now, 2.5);
  const window3hEnd = addHours(now, 3.5);

  const { data: appts3h, error: error3h } = await supabaseAdmin
    .from('appointments')
    .select('*, clients(nome, whatsapp), user_profile:profiles!appointments_user_id_fkey(whatsapp)')
    .eq('reminder_3h_sent', false)
    .eq('status', 'scheduled')
    .gte('start_time', window3hStart.toISOString())
    .lte('start_time', window3hEnd.toISOString());

  if (error3h) console.error('Erro ao buscar appts 3h:', error3h);

  let sent3h = 0;
  if (appts3h && appts3h.length > 0) {
    for (const app of appts3h) {
      const userWhatsapp = app.user_profile?.whatsapp;
      if (!userWhatsapp) continue;

      const formattedDate = format(parseISO(app.start_time), 'dd/MM/yyyy HH:mm');
      const message = `🔥 *URGENTE: 3 HORAS*\n\n📍 *Compromisso:* ${app.title}\n📅 *Data/Hora:* ${formattedDate}\n👤 *Cliente:* ${app.clients?.nome || 'N/A'}\n📍 *Local:* ${app.location || 'Não informado'}\n\n_Prepare-se para o atendimento!_`;
      
      const success = await sendWhatsApp(userWhatsapp as string, message);
      if (success) {
        await supabaseAdmin.from('appointments').update({ reminder_3h_sent: true }).eq('id', app.id);
        sent3h++;
      }
    }
  }

  return NextResponse.json({ 
    success: true, 
    sent24h, 
    sent3h, 
    timestamp: now.toISOString() 
  });
}
