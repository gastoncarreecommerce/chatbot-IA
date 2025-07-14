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
Sos el Asistente Carrefour Argentina. Respondé solo con un JSON plano con:
- "tipo": uno de ["productos", "recetas", "ayuda"]
- "respuesta": texto simpático con emojis

Si tipo = "productos", agregá también "query": string
Si tipo = "recetas", agregá "receta": texto y "ingredientes": array
Si tipo = "ayuda", podés agregar "info": texto útil

NO EXPLIQUES NADA. NO agregues texto antes ni después. SOLO el JSON.
Ejemplo:

{
  "tipo": "productos",
  "respuesta": "¡Mirá estas opciones! 🛒",
  "query": "leche"
}
`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-3.5-turbo", // Modelo más confiable
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: mensaje }
        ]
      })
    });

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return res.status(200).json({
        tipo: "ayuda",
        info: "Soy tu asistente Carrefour. Podés pedirme productos, recetas o promociones 😊"
      });
    }

    // Limpiar bloque ```json si lo hay
    content = content.replace(/^```json/, '').replace(/```$/, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.warn("Falla al parsear. Respuesta original:", content);
      return res.status(200).json({
        tipo: "ayuda",
        info: "Podés buscar productos, pedir una receta o consultar promociones 🛒"
      });
    }

    // Validación mínima
    if (!parsed.tipo || (!parsed.respuesta && !parsed.info)) {
      return res.status(200).json({
        tipo: "ayuda",
        info: "Estoy acá para ayudarte. ¿Querés buscar productos, recetas o promos? 😊"
      });
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error("Error en chatbot:", err);
    return res.status(500).json({ error: "Error interno", detalle: err.message });
  }
};

export default allowCors(handler);
