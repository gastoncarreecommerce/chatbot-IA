// File: api/chatbot.js

/**
 * CORS middleware para que tu widget DY pueda llamar al endpoint
 */
const allowCors = (handler) => async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  return handler(req, res);
};

/**
 * Handler principal: recibe { mensaje } y devuelve JSON según intención
 */
const handler = async (req, res) => {
  try {
    const { mensaje } = req.body;
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!mensaje) return res.status(400).json({ error: 'Falta el campo "mensaje".' });
    if (!apiKey)  return res.status(500).json({ error: 'OPENROUTER_API_KEY no configurada.' });

    const systemPrompt = `
Sos el Asistente Inteligente de Compras Carrefour Argentina.  
Detectá la intención y devolvé SIEMPRE un JSON plano con:
1) "tipo": uno de ["productos","promociones","recetas","ayuda"]
2) "respuesta": frase amigable (puede llevar emoji)
3) Solo uno de estos bloques según tipo:
  - productos: array "productos" de { nombre, sku, link, precio, imagen }
  - promociones: array "promociones" de { titulo, descripcion, vigencia, link }
  - recetas: campos "receta" (texto) e "ingredientes" (array de strings)
  - ayuda: campo "info" (texto con la ayuda solicitada)
IMPORTANTE: NO agregues nada fuera del JSON, ni markdown, ni comentarios.
Si no entendés, devolvé tipo:"ayuda" con info genérica sobre qué podés hacer.
`;

    const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openrouter/cypher-alpha:free',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: mensaje }
        ],
        temperature: 0.7,
        top_p: 0.9
      })
    });

    if (!orRes.ok) {
      const errText = await orRes.text();
      console.error('OpenRouter error:', errText);
      return res.status(502).json({ error: 'Error en la IA', detalle: errText });
    }

    const orData = await orRes.json();
    let content = orData.choices?.[0]?.message?.content || '';
    content = content.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();

    let payload;
    try {
      payload = JSON.parse(content);
    } catch (e) {
      console.error('JSON inválido de IA:', content);
      return res.status(500).json({ error: 'Respuesta JSON inválida', raw: content });
    }

    if (!payload.tipo || !payload.respuesta) {
      return res.status(500).json({ error: 'Falta "tipo" o "respuesta" en JSON', payload });
    }

    return res.status(200).json(payload);

  } catch (err) {
    console.error('Error interno en /api/chatbot:', err);
    return res.status(500).json({ error: 'Error interno', detalle: err.message });
  }
};

export default allowCors(handler);
