import React, { useEffect, useRef, useState } from "react";

export default function ChatUIFade() {
  const [mensajes, setMensajes] = useState([]);
  const [input, setInput] = useState("");
  const [nuevoId, setNuevoId] = useState("");
  const [nuevoTexto, setNuevoTexto] = useState("");
  const [namespaces, setNamespaces] = useState([]);
  const [namespace, setNamespace] = useState("");
  const [nuevoNamespace, setNuevoNamespace] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/namespaces`)
      .then((res) => res.json())
      .then((data) => {
        setNamespaces(data);
        setNamespace(data[0] || "");
      });
  }, []);

  const scrollToEnd = () => {
    if (endRef.current) endRef.current.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToEnd, [mensajes]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const nuevoMensaje = { tipo: "usuario", texto: input };
    setMensajes((prev) => [...prev, nuevoMensaje]);
    setInput("");

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/preguntar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje: input })
      });

      const data = await res.json();
      setMensajes((prev) => [...prev, { tipo: "asistente", texto: data.respuesta }]);
    } catch (error) {
      console.error("Error al obtener la respuesta:", error);
      setMensajes((prev) => [...prev, { tipo: "error", texto: "Error al conectar con el servidor" }]);
    }
  };

  const handleSubirTexto = async () => {
    const namespaceFinal = namespace === "__nuevo__" ? nuevoNamespace : namespace;
    if (!nuevoId || !nuevoTexto || !namespaceFinal) return alert("Rellena todos los campos.");

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/subir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: nuevoId, texto: nuevoTexto, namespace: namespaceFinal })
      });

      const data = await res.json();
      if (data.ok) alert("Texto subido correctamente");
      else alert("Error al subir");
    } catch (error) {
      console.error("Error al subir texto:", error);
    }
  };

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded shadow mb-4 h-96 overflow-y-auto">
        {mensajes.map((msg, i) => (
          <div key={i} className={`my-2 ${msg.tipo === "usuario" ? "text-right" : "text-left"}`}>
            <span
              className={`inline-block px-3 py-2 rounded-lg ${
                msg.tipo === "usuario"
                  ? "bg-blue-500 text-white"
                  : msg.tipo === "asistente"
                  ? "bg-gray-300 dark:bg-gray-700 dark:text-white"
                  : "bg-red-400 text-white"
              }`}
            >
              {msg.texto}
            </span>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="flex gap-2 mb-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
          placeholder="Escribe tu mensaje..."
          className="flex-1 px-4 py-2 rounded border"
        />
        <button onClick={handleSendMessage} className="px-4 py-2 bg-blue-600 text-white rounded">
          Enviar
        </button>
      </div>

      <div className="bg-white dark:bg-gray-900 p-4 rounded shadow">
        <h2 className="text-lg font-semibold mb-2">Subir texto manual</h2>

        <input
          type="text"
          placeholder="ID único"
          value={nuevoId}
          onChange={(e) => setNuevoId(e.target.value)}
          className="w-full mb-2 px-3 py-1 rounded border"
        />

        <textarea
          rows="3"
          placeholder="Texto o descripción técnica"
          value={nuevoTexto}
          onChange={(e) => setNuevoTexto(e.target.value)}
          className="w-full mb-2 px-3 py-2 rounded border"
        ></textarea>

        <select
          value={namespace}
          onChange={(e) => setNamespace(e.target.value)}
          className="w-full mb-2 px-3 py-1 rounded border"
        >
          {namespaces.map((ns) => (
            <option key={ns} value={ns}>{ns}</option>
          ))}
          <option value="__nuevo__">-- Nuevo namespace --</option>
        </select>

        {namespace === "__nuevo__" && (
          <input
            type="text"
            placeholder="Nombre del nuevo namespace"
            value={nuevoNamespace}
            onChange={(e) => setNuevoNamespace(e.target.value)}
            className="w-full mb-2 px-3 py-1 rounded border"
          />
        )}

        <button
          onClick={handleSubirTexto}
          className="px-4 py-2 bg-green-600 text-white rounded w-full"
        >
          Subir a Pinecone
        </button>
      </div>
    </div>
  );
}
