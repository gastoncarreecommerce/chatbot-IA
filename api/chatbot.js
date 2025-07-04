// api/chatbot.js

const allowCors = (handler) => async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  return handler(req, res);
};

const handler = async (req, res) => {
  const { mensaje } = req.body;
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!mensaje || !apiKey) {
    return res.status(400).json({ error: "Falta mensaje o API Key" });
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openrouter/cypher-alpha:free",
        messages: [
          {
            role: "user",
            content: `Sos un asistente de compras de supermercado Carrefour Argentina. El usuario te dice: "${mensaje}". 
Tu respuesta debe ser útil, clara y amable. Con buena onda y si podes con algun que otro emoji.

Si te pregunta por alguna comida o idea de receta o si te consulta sobre que puede cocinar, devolvé solo un JSON como este:
{
  "respuesta": "Frase conversacional para el usuario",
  "receta": "Explicacion paso a paso de una receta simple y rica"
  "ingredientes": ["ingrediente1", "ingrediente2", "ingrediente3"]
}

Si te pregunta por algun producto, item, marca o promocion, devolvé solo un JSON como este:
{
  "respuesta": "Frase conversacional para el usuario",
  "producto": "Nombre del producto"
  "Link del producto": "Link del producto armado asi: https://www.carrefour.com.ar/PRODUCTO-ACÁ"
  "Precio": ["Precio del producto"]
}

No expliques nada. No agregues texto fuera del JSON. Solo devolvé el JSON plano.`
          }
        ]
      })
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return res.status(500).json({ error: "No se generó respuesta", detalle: data });
    }

    // Limpiar si viene con ```json
    let raw = content.trim();
    if (raw.startsWith("```json")) {
      raw = raw.replace(/^```json/, "").replace(/```$/, "").trim();
    }

    let json;
    try {
      json = JSON.parse(raw);
    } catch (e) {
      return res.status(500).json({ error: "Respuesta inválida de la IA", raw });
    }

    return res.status(200).json(json);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error interno", detalle: err.message });
  }
};

export default allowCors(handler);
