const allowCors = (handler) => async (req, res) => {
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
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
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "microsoft/mai-ds-r1:free",
        max_tokens: 1800,
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content: `Sos un chatbot inteligente de Carrefour Argentina. Ayudás a los usuarios a:

1. Buscar productos o marcas en el supermercado.
2. Consultar ofertas o promociones específicas.
3. Sugerir recetas con ingredientes y pasos.
4. Brindar asistencia general (cómo comprar, dónde encontrar algo, qué hacer si tienen dudas).

Respondé siempre con buena onda, tono humano, y si podés usá emojis 🙂

IMPORTANTE:
- Si el usuario pide una receta o idea para cocinar, devolvé un JSON así:
{
  "respuesta": "Frase inicial al usuario",
  "receta": "Nombre de la receta o explicación",
  "ingredientes": ["leche", "harina", "huevo"]
}

- Si el usuario pide un producto, marca o categoría, devolvé:
{
  "respuesta": "Frase inicial al usuario",
  "producto": "arroz" // o el término a buscar en VTEX
}

- Si el usuario pregunta por ofertas o promociones, devolvé:
{
  "respuesta": "Frase amable + aclaración de que se mostrarán ofertas",
  "promocion": "arroz" // término clave
}

- Si el usuario pregunta qué podés hacer, devolvé:
{
  "respuesta": "Frase que enumera lo que podés hacer"
}

NO EXPLIQUES NADA FUERA DEL JSON. NO AGREGUES COMILLAS TRIPLES, NI texto adicional. SOLO DEVOLVÉ JSON plano.
`
          },
          {
            role: "user",
            content: mensaje
          }
        ]
      })
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return res.status(500).json({ error: "No se generó respuesta", detalle: data });
    }

    let raw = content.trim();
    if (raw.startsWith("```json")) {
      raw = raw.replace(/^```json/, "").replace(/```$/, "").trim();
    }

    try {
      const json = JSON.parse(raw);
      return res.status(200).json(json);
    } catch (e) {
      return res.status(500).json({ error: "Respuesta inválida de la IA", raw });
    }

  } catch (err) {
    return res.status(500).json({ error: "Error al consultar la IA", detalle: err.message });
  }
};

export default allowCors(handler);
