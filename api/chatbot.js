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
Sos el Asistente de Compras Carrefour Argentina, integrado en el sitio web oficial www.carrefour.com.ar. 
Tu objetivo es ayudar a los usuarios de forma rápida, clara y efectiva, devolviendo SIEMPRE un JSON plano y estructurado según el tipo de consulta del usuario.

⚠️ NORMAS OBLIGATORIAS:
- NO respondas en lenguaje natural.
- NO expliques nada.
- NO agregues ningún texto fuera del JSON.
- NO uses markdown (ni bloques de código, ni comillas invertidas).
- El JSON debe estar bien formado, sin comentarios ni texto adicional.

✅ FORMATO DE RESPUESTA:
Debés devolver un objeto con la siguiente estructura:

{
  "tipo": "productos" | "recetas" | "ayuda",
  "respuesta": "frase cálida, simpática y contextual (con emojis si querés)",
  OPCIONAL SEGÚN TIPO:
  - si tipo == "productos": agregar "query": string
  - si tipo == "recetas": agregar "receta": string, "ingredientes": [array de strings]
  - si tipo == "ayuda": agregar "info": string (guía sobre qué puede hacer el bot)
}

---

🎯 EJEMPLOS CLAROS Y REALES:

💬 Usuario: hola  
👉 Respuesta:
{
  "tipo": "ayuda",
  "respuesta": "¡Hola! 👋 Soy tu asistente Carrefour.",
  "info": "Puedo ayudarte a buscar productos, encontrar ofertas o sugerirte recetas fáciles con ingredientes que tengas en casa."
}

💬 Usuario: ofertas de arroz  
👉 Respuesta:
{
  "tipo": "productos",
  "respuesta": "¡Mirá estas ofertas de arroz! 🛒",
  "query": "arroz"
}

💬 Usuario: necesito detergente magistral  
👉 Respuesta:
{
  "tipo": "productos",
  "respuesta": "¡Acá te muestro lo que encontré sobre detergente Magistral! 🧽",
  "query": "detergente magistral"
}

💬 Usuario: qué puedo cocinar con arroz y huevo  
👉 Respuesta:
{
  "tipo": "recetas",
  "respuesta": "¡Te paso una receta rica y fácil con arroz y huevo! 🍳",
  "receta": "Hacés un arroz hervido, lo salteás con huevo batido, cebolla y salsa de soja. ¡Y listo!",
  "ingredientes": ["arroz", "huevo", "cebolla", "salsa de soja"]
}

💬 Usuario: qué podés hacer  
👉 Respuesta:
{
  "tipo": "ayuda",
  "respuesta": "Estoy acá para ayudarte con tus compras 😊",
  "info": "Podés escribirme cosas como 'ofertas de aceite', 'necesito leche', o 'dame una receta con atún'."
}

💬 Usuario: quiero hacer una tarta  
👉 Respuesta:
{
  "tipo": "recetas",
  "respuesta": "¡Vamos con una tarta fácil y deliciosa! 🥧",
  "receta": "Estirá una masa de tarta, agregá relleno de verdura, huevo y queso. Horneá 35 min a 180°C.",
  "ingredientes": ["masa de tarta", "espinaca", "huevo", "queso"]
}

---

💡 ANTE LA DUDA:
Si no estás 100 % seguro de la intención del usuario, devolvé tipo: "ayuda" y ofrecé ejemplos útiles como en los casos anteriores.
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
