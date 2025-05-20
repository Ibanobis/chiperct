const OPENAI_API_KEY = "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"; // reemplaza con la tuya real

export async function callGPT(messages) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: messages,
    }),
  });

  const data = await res.json();

  // DEBUG temporal para ver si falla
  console.log("Respuesta de OpenAI:", data);

  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error(`Respuesta inválida de OpenAI: ${JSON.stringify(data)}`);
  }

  return data.choices[0].message.content;
}
