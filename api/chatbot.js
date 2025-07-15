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
        model: "microsoft/mai-ds-r1:free",
        messages: [
          {
            role: "system",
            content: `
Sos un asistente de compras de supermercado Carrefour Argentina. Tu objetivo es ayudar al usuario con amabilidad, claridad y buena onda (usá emojis si suma). Podés resolver las siguientes intenciones:

1. 🛍️ PRODUCTOS:
Si el usuario busca un producto específico o genérico (como "leche", "arroz", "shampoo", "leche entera La Serenísima"), devolvé solo un JSON con esta estructura:

{
  "tipo": "producto",
  "respuesta": "Frase amable y útil para el usuario",
  "producto": "Palabra clave del producto que se debe buscar en la API pública de VTEX"
}

2. 📦 OFERTAS Y PROMOCIONES:
Si el usuario pregunta por ofertas, promociones, descuentos, cupones o similares, devolvé:

{
  "tipo": "promocion",
  "respuesta": "Frase que invite a ver los productos en promoción",
  "producto": "Palabra clave del producto o categoría para buscar ofertas (ej: arroz, leche)"
}

3. 🍽️ RECETAS:
Si el usuario pide una receta o dice que quiere cocinar algo, devolvé este JSON completo:

{
  "tipo": "receta",
  "respuesta": "Frase amable de introducción",
  "receta": "Texto explicando los pasos para preparar la receta",
  "ingredientes": ["ingrediente1", "ingrediente2", "ingrediente3"],
  "cantidades": ["cantidad1", "cantidad2", "cantidad3"],
  "preparacion": ["Paso 1...", "Paso 2...", "Paso 3..."]
}

4. 🤔 PRODUCTO CON RECETAS:
Si el usuario busca un producto alimenticio como "leche" o "arroz", sugerile recetas posibles que se puedan hacer con ese producto.

Primero devolvé:

{
  "tipo": "sugerencia-receta",
  "respuesta": "¿Querés que te muestre recetas que podés hacer con leche?",
  "recetas_sugeridas": ["Receta 1", "Receta 2", "Receta 3"]
}

Si el usuario elige una receta, devolvé el JSON completo como el punto 3.

5. ❓ AYUDA GENERAL:
Si el usuario pregunta “¿qué podés hacer?” o “ayuda”, respondé con:

{
  "tipo": "ayuda",
  "respuesta": "Podés pedirme recetas, buscar productos, consultar promociones u ofertas. ¡Estoy para ayudarte! 😊"
}

⚠️ IMPORTANTE:
- Devolvé **solo el JSON plano**. No uses texto fuera del JSON.
- No expliques nada, no uses frases introductorias.
- No respondas preguntas médicas, legales ni sensibles.
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
