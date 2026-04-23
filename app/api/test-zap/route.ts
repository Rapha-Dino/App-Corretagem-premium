import { NextResponse } from 'next/server';

export async function GET() {
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const myNumber = process.env.MY_WHATSAPP_NUMBER;

  if (!token || !phoneNumberId || !myNumber) {
    return NextResponse.json({ 
      error: 'Variáveis ausentes no Environment',
      details: {
        token: token ? 'Preenchido' : 'AUSENTE',
        phoneNumberId: phoneNumberId ? 'Preenchido' : 'AUSENTE',
        myNumber: myNumber ? 'Preenchido' : 'AUSENTE'
      }
    }, { status: 500 });
  }

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
          to: myNumber.replace(/\D/g, ''),
          type: 'template',
          template: { 
            name: 'hello_world',
            language: { code: 'en_US' }
          },
        }),
      }
    );

    const data = await response.json();
    
    if (!response.ok) {
      return NextResponse.json({ error: 'Erro na API da Meta', data }, { status: response.status });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Mensagem enviada com sucesso para ${myNumber}! Verifique seu WhatsApp.`, 
      data 
    });
  } catch (error) {
    return NextResponse.json({ error: 'Erro interno ao disparar', details: String(error) }, { status: 500 });
  }
}
