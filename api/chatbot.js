const allowCors = (handler) => async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  return handler(req, res);
};

const handler = async (req, res) => {
  const { mensaje } = req.body;
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!mensaje || !apiKey) {
    return res.status(400).json({ error: "Falta mensaje o API Key" });
  }

  try {
    const systemPrompt = `
Sos un asistente de compras inteligente de Carrefour Argentina. El usuario puede pedirte:

- Productos (ej: "leche", "arroz", "detergente magistral")
- Promociones (ej: "ofertas de arroz", "tienen promos de lavandina?")
- Recetas (ej: "que puedo cocinar con carne picada?", "receta con arroz y pollo")
- Ayuda general (ej: "hola", "qué puedes hacer?")

Siempre respondé en formato JSON puro. Elegí SOLO UNO de estos tipos y respondé según el caso:

// Receta:
{
  "tipo": "receta",
  "respuesta": "¡Claro! Podés preparar esta receta...",
  "receta": "Paso a paso de la receta",
  "ingredientes": ["arroz", "pollo", "cebolla"]
}

// Producto:
{
  "tipo": "producto",
  "respuesta": "Mirá este producto que encontré:",
  "producto": "Leche La Serenísima",
  "link": "https://www.carrefour.com.ar/leche-la-serenisima/p",
  "precio": "$799"
}

// Promo:
{
  "tipo": "promocion",
  "respuesta": "Encontré una promo buenísima 😊",
  "producto": "Arroz Dos Hermanos 1kg",
  "link": "https://www.carrefour.com.ar/arroz-dos-hermanos-1kg/p",
  "precio": "$499"
}

// Ayuda:
{
  "tipo": "ayuda",
  "info": "Soy tu asistente Carrefour. Podés pedirme productos, recetas o promociones 😊"
}

IMPORTANTE:
- No agregues texto fuera del JSON.
- NO EXPLIQUES nada.
- El mensaje del usuario es: """${mensaje}"""
`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-r1-0528-qwen3-8b:free',
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: mensaje }
        ]
      })
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) return res.status(500).json({ error: "Sin respuesta", detalle: data });

    let raw = content.trim();
    if (raw.startsWith("```json")) {
      raw = raw.replace(/^```json/, "").replace(/```$/, "").trim();
    }

    try {
      const json = JSON.parse(raw);
      return res.status(200).json(json);
    } catch (e) {
      return res.status(500).json({ error: "JSON inválido", raw });
    }

  } catch (err) {
    return res.status(500).json({ error: "Error interno", detalle: err.message });
  }
};

export default allowCors(handler);
