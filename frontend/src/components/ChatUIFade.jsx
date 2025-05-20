import { useState, useEffect, useRef } from 'react';
import { Send, Mic, Paperclip, Image, User, Bot } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function ChatUIFade() {
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "¡Hola! Soy tu asistente de mecanizado. ¿En qué puedo ayudarte hoy?",
      isBot: true,
      isAnimating: false,
      animationComplete: true,
      displayedText: ""
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [nuevoTexto, setNuevoTexto] = useState('');
  const [nuevoId, setNuevoId] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [namespaces, setNamespaces] = useState([]);
  const [namespace, setNamespace] = useState('');
  const [nuevoNamespace, setNuevoNamespace] = useState('');
  const messagesEndRef = useRef(null);
  const [isTyping, setIsTyping] = useState(false);
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/namespaces`)
      .then(res => res.json())
      .then(data => {
        setNamespaces(data);
        setNamespace(data[0] || '');
      });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      text: inputText,
      isBot: false,
      isAnimating: false,
      animationComplete: true,
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputText;
    setInputText('');
    setIsTyping(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/preguntar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje: currentInput })
      });

      const data = await response.json();
      const botId = `bot-${Date.now()}`;

      const botMessage = {
        id: botId,
        text: data.respuesta,
        isBot: true,
        isAnimating: true,
        animationComplete: false,
        displayedText: ""
      };

      setMessages(prev => [...prev, botMessage]);

      const words = data.respuesta.split(' ');
      let wordIndex = 0;

      const interval = setInterval(() => {
        if (wordIndex < words.length) {
          const nextWord = wordIndex > 0 ? ' ' + words[wordIndex] : words[wordIndex];
          setMessages(prev =>
            prev.map(msg =>
              msg.id === botId ? { ...msg, displayedText: (msg.displayedText || '') + nextWord } : msg
            )
          );
          wordIndex++;
        } else {
          clearInterval(interval);
          setMessages(prev =>
            prev.map(msg =>
              msg.id === botId ? { ...msg, animationComplete: true, isAnimating: false } : msg
            )
          );
        }
      }, 70);

    } catch (error) {
      console.error("Error al obtener la respuesta:", error);
      setMessages(prev => [...prev, {
        id: `bot-${Date.now()}`,
        text: "❌ Error al conectar con el servidor. Asegúrate de que el backend está corriendo.",
        isBot: true,
        isAnimating: false,
        animationComplete: true
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSubirTexto = async () => {
    const namespaceFinal = namespace === "__nuevo__" ? nuevoNamespace : namespace;
    if (!nuevoId.trim() || !nuevoTexto.trim() || !namespaceFinal.trim()) {
      setConfirmacion("❌ Debes llenar todos los campos.");
      return;
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/subir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: nuevoId, texto: nuevoTexto, namespace: namespaceFinal })
      });

      const data = await res.json();
      if (res.ok) {
        setConfirmacion("✅ Subido correctamente a Pinecone.");
        setNuevoTexto('');
        setNuevoId('');
      } else {
        setConfirmacion("❌ Error: " + data.error);
      }
    } catch (err) {
      console.error("Error al subir texto:", err);
      setConfirmacion("❌ Error al conectar con el servidor.");
    }
  };

  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      .animate-fade-in {
        animation: fadeIn 0.5s forwards;
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  return (
    <div className={`flex h-screen ${theme === 'dark' ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-800'}`}>
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className={`flex-1 overflow-y-auto p-4 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map(message => (
              <div key={message.id} className={`flex ${message.isBot ? 'justify-start' : 'justify-end'}`}>
                <div className={`flex max-w-xl ${message.isBot ? 'items-start' : 'items-end'}`}>
                  {message.isBot && (
                    <div className="flex-shrink-0 mr-3">
                      <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white">
                        <Bot size={18} />
                      </div>
                    </div>
                  )}
                  <div className={`px-4 py-3 rounded-2xl ${
                    message.isBot
                      ? theme === 'dark'
                        ? 'bg-gray-800 text-gray-100'
                        : 'bg-white text-gray-800 shadow-sm border border-gray-100'
                      : 'bg-blue-600 text-white'
                  }`}>
                    {message.isBot && !message.animationComplete ? (
                      <p>{message.displayedText}</p>
                    ) : message.isBot ? (
                      <ReactMarkdown>{message.text}</ReactMarkdown>
                    ) : (
                      <p>{message.text}</p>
                    )}
                  </div>
                  {!message.isBot && (
                    <div className="flex-shrink-0 ml-3">
                      <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-600">
                        <User size={18} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="flex items-start">
                  <div className="flex-shrink-0 mr-3">
                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white">
                      <Bot size={18} />
                    </div>
                  </div>
                  <div className={`px-6 py-4 rounded-2xl ${theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-gray-100 shadow-sm'}`}>
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
        <div className={`${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-t p-4`}>
          <div className="max-w-3xl mx-auto">
            <div className={`flex items-center ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'} rounded-lg p-2`}>
              <button className={`p-2 rounded-full ${theme === 'dark' ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}`}>
                <Paperclip size={20} className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} />
              </button>
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Escribe tu consulta sobre mecanizado..."
                className={`flex-1 ${theme === 'dark' ? 'bg-gray-700 text-gray-100' : 'bg-gray-100 text-gray-800'} outline-none px-3 py-1`}
              />
              <button className={`p-2 rounded-full ${theme === 'dark' ? 'hover:bg-gray-600' : 'hover:bg-gray-200'} mx-1`}>
                <Image size={20} className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} />
              </button>
              <button className={`p-2 rounded-full ${theme === 'dark' ? 'hover:bg-gray-600' : 'hover:bg-gray-200'} mr-1`}>
                <Mic size={20} className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} />
              </button>
              <button onClick={handleSendMessage} className="p-2 rounded-full bg-blue-600 text-white hover:bg-blue-700">
                <Send size={20} />
              </button>
            </div>
            <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} mt-2 text-center`}>
              Pregúntame sobre velocidades de corte, materiales, o resolución de problemas en mecanizado CNC
            </p>

            <div className="mt-6 p-4 border rounded-xl bg-gray-100 dark:bg-gray-800">
              <h2 className="font-semibold mb-2">Subir conocimiento a Pinecone</h2>
              <input
                type="text"
                placeholder="ID único (ej. producto123)"
                value={nuevoId}
                onChange={e => setNuevoId(e.target.value)}
                className="w-full mb-2 px-3 py-1 rounded bg-white dark:bg-gray-700 dark:text-white"
              />
              <textarea
                rows={3}
                placeholder="Texto o descripción técnica..."
                value={nuevoTexto}
                onChange={e => setNuevoTexto(e.target.value)}
                className="w-full mb-2 px-3 py-2 rounded bg-white dark:bg-gray-700 dark:text-white"
              />
              <select
                value={namespace}
                onChange={(e) => setNamespace(e.target.value)}
                className="w-full mb-2 px-3 py-1 rounded bg-white dark:bg-gray-700 dark:text-white"
              >
                {namespaces.map(ns => (
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
                  className="w-full mb-2 px-3 py-1 rounded bg-white dark:bg-gray-700 dark:text-white"
                />
              )}
              <button
                onClick={handleSubirTexto}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Subir a Pinecone
              </button>
              {confirmacion && (
                <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{confirmacion}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
