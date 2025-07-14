// File: api/chatbot.js

const allowCors = (handler) => async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  return handler(req, res);
};

const handler = async (req, res) => {
  try {
    const { mensaje } = req.body;
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!mensaje || !apiKey) {
      return res.status(400).json({ error: 'Falta mensaje o API Key' });
    }

    const systemPrompt = `
Sos el Asistente Carrefour Argentina. Respondé con un JSON plano y sin explicación, solo con estos campos:

- "tipo": uno de ["productos", "recetas", "ayuda"]
- "respuesta": frase simpática para el usuario
- Si tipo = "productos": devolvé también "query": con el término buscado (ej: "arroz")
- Si tipo = "recetas": devolvé "receta": texto y "ingredientes": array
- Si tipo = "ayuda": devolvé "info": texto

Ejemplos de usuario y cómo responder:
- "ofertas de leche" → tipo: "productos", query: "leche"
- "quiero hacer una tarta" → tipo: "recetas"
- "hola" o "qué podés hacer" → tipo: "ayuda"
- JAMÁS devuelvas texto fuera del JSON ni uses markdown.
`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openrouter/cypher-alpha:free",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: mensaje }
        ]
      })
    });

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return res.status(500).json({ error: "Respuesta vacía de IA" });

    if (content.startsWith("```json")) {
      content = content.replace(/^```json/, "").replace(/```$/, "").trim();
    }

    let json;
    try {
      json = JSON.parse(content);
    } catch (e) {
      return res.status(500).json({ error: "No se pudo parsear JSON", raw: content });
    }

    return res.status(200).json(json);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error interno", detalle: err.message });
  }
};

export default allowCors(handler);
