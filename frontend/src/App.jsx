import React, { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

function App() {
  const logo = "/logo.png";
  const QUICK_PROMPT_OPTIONS = [
    { label: "5 livros de comédia", prompt: "Me dê 5 recomendações de livros de comédia." },
    { label: "10 séries de suspense", prompt: "Quero 10 recomendações de séries de suspense." },
    { label: "20 filmes sci-fi", prompt: "Me recomende 20 filmes de ficção científica." },
    { label: "8 livros fantasia", prompt: "Liste 8 livros de fantasia para iniciantes." },
  ];

  const parseChatHistory = () => {
    try {
      const raw = localStorage.getItem("chat_history");
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const [agentName, setAgentName] = useState(() => {
    const saved = localStorage.getItem("agent_name");
    // Migra valor legado para o novo padrão da marca.
    if (!saved || !saved.trim() || saved.trim() === "Nova AI") {
      return "EratoChat";
    }
    return saved;
  });
  const [temaAtual, setTemaAtual] = useState(() => localStorage.getItem("app_theme") || "theme-azul-marinho");
  const [chats, setChats] = useState(parseChatHistory);
  const [activeChatId, setActiveChatId] = useState(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingChatId, setLoadingChatId] = useState(null);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  /** Evita envio duplo (duplo clique / cartão + Enter) enquanto a requisição está ativa */
  const sendInFlightRef = useRef(false);
  const MAX_INPUT_CHARS = 1200;

  // Apply theme to body
  useEffect(() => {
    document.body.className = temaAtual;
    localStorage.setItem("app_theme", temaAtual);
  }, [temaAtual]);

  // Garante que a aba do navegador use a mesma logo da interface.
  useEffect(() => {
    let favicon = document.querySelector("link[rel='icon']");
    if (!favicon) {
      favicon = document.createElement("link");
      favicon.setAttribute("rel", "icon");
      document.head.appendChild(favicon);
    }
    favicon.setAttribute("type", "image/png");
    favicon.setAttribute("href", logo);
  }, []);

  // Set initial active chat if chats exist
  useEffect(() => {
    if (chats.length > 0 && !activeChatId) {
      setActiveChatId(chats[0].id);
    }
  }, [chats, activeChatId]);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chats, activeChatId, isLoading]);

  // Adjust textarea height
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = inputRef.current.scrollHeight + 'px';
    }
  }, [inputText]);

  // Close dropdown on outside click
  useEffect(() => {
    const closeDropdown = () => setOpenDropdownId(null);
    document.addEventListener('click', closeDropdown);
    return () => document.removeEventListener('click', closeDropdown);
  }, []);

  const createNewChat = () => {
    const newId = "chat_" + Date.now();
    const newChat = {
      id: newId,
      title: "Nova conversa",
      messages: []
    };
    const updatedChats = [newChat, ...chats];
    setChats(updatedChats);
    localStorage.setItem("chat_history", JSON.stringify(updatedChats));
    setActiveChatId(newId);
  };

  const deleteChat = (chatId, e) => {
    e.stopPropagation();
    const updatedChats = chats.filter(c => c.id !== chatId);
    setChats(updatedChats);
    localStorage.setItem("chat_history", JSON.stringify(updatedChats));
    if (activeChatId === chatId) {
      setActiveChatId(updatedChats.length > 0 ? updatedChats[0].id : null);
    }
  };

  const deleteAllChats = () => {
    if (window.confirm("Tem certeza que deseja apagar todas as conversas? Essa ação não pode ser desfeita.")) {
      setChats([]);
      setActiveChatId(null);
      localStorage.setItem("chat_history", JSON.stringify([]));
      setIsConfigOpen(false);
    }
  };

  const formatAssistantRecommendations = (rawText) => {
    let text = (rawText || "").replace(/\r\n/g, "\n");

    // Normaliza o rótulo para manter um padrão visual único
    text = text.replace(
      /\*{0,2}\s*Por que vai gostar\s*\*{0,2}\s*:\s*\*{0,3}\s*/gi,
      "**Por que vai gostar:** "
    );

    // Se um item numerado (1..30) vier grudado ao fim da linha anterior, quebra.
    // Evita falso positivo em trechos como "anos 60.".
    text = text.replace(/([^\n])\s+(\d{1,2}\.\s+)/g, (full, prevChar, itemPrefix) => {
      const n = Number.parseInt(itemPrefix, 10);
      if (!Number.isNaN(n) && n >= 1 && n <= 30) {
        return `${prevChar}\n\n${itemPrefix}`;
      }
      return full;
    });

    // Separa blocos por item numerado (1., 2., 3., ...)
    const itemStartRegex = /(^|\n)(\d{1,2}\.\s)/g;
    const starts = [];
    let match;
    while ((match = itemStartRegex.exec(text)) !== null) {
      starts.push(match.index + match[1].length);
    }

    if (starts.length >= 2) {
      const blocks = starts.map((start, idx) => {
        const end = idx + 1 < starts.length ? starts[idx + 1] : text.length;
        return text.slice(start, end).trim();
      });

      const normalizedBlocks = blocks.map((block) => {
        let b = block
          // Corrige casos de numeração duplicada no início do item: "1. 1. Título"
          .replace(/^\s*(\d{1,2})\.\s+\1\.\s+/m, "$1. ")
          .replace(/([^\n])\s+(\*\*Por que vai gostar:\*\*)/gi, "$1\n\n$2")
          .replace(/\n{3,}/g, "\n\n")
          .trim();

        // Ajusta casos onde título/ano e descrição vêm colados na mesma linha.
        // Ex.: "20. Beach Read (Emily Henry), 2020 Dois escritores..."
        const lines = b.split("\n");
        if (lines.length >= 1) {
          const first = lines[0].trim();
          const headerAndDesc = first.match(
            /^(\d{1,2}\.\s+.*?(?:\(\d{4}\)|,\s*\d{4}\b|\([^)\n]{2,80}\)))(?:\s+)(.+)$/
          );
          if (headerAndDesc && headerAndDesc[2].length > 20) {
            lines[0] = headerAndDesc[1].trim();
            lines.splice(1, 0, headerAndDesc[2].trim());
            b = lines.join("\n");
          }
        }

        // Remove asterisco órfão no fim de linha (ex.: "... irresistível.*")
        b = b.replace(/(?<!\*)\*(?!\*)(?=\s*$)/gm, "");

        return b.trim();
      });

      text = normalizedBlocks.join("\n\n---\n\n");
    } else {
      text = text
        // Corrige casos de numeração duplicada no início do item: "1. 1. Título"
        .replace(/^\s*(\d{1,2})\.\s+\1\.\s+/m, "$1. ")
        .replace(/([^\n])\s+(\*\*Por que vai gostar:\*\*)/gi, "$1\n\n$2")
        .replace(/\n{3,}/g, "\n\n")
        // Remove asterisco órfão no fim de linha (ex.: "... irresistível.*")
        .replace(/(?<!\*)\*(?!\*)(?=\s*$)/gm, "");
    }

    return text.trim();
  };

  const handleSend = async (overrideText) => {
    const textToSend = typeof overrideText === 'string' ? overrideText : inputText.trim();
    if (!textToSend || isLoading || sendInFlightRef.current) return;
    if (textToSend.length > MAX_INPUT_CHARS) {
      alert(`Sua mensagem ultrapassa ${MAX_INPUT_CHARS} caracteres.`);
      return;
    }
    sendInFlightRef.current = true;

    let currentChatId = activeChatId;
    if (!currentChatId) {
      currentChatId = "chat_" + Date.now();
      const newChat = { id: currentChatId, title: "Nova conversa", messages: [] };
      setChats(prev => [newChat, ...prev]);
      setActiveChatId(currentChatId);
    }

    setInputText("");
    setIsLoading(true);
    setLoadingChatId(currentChatId);

    // Uma única atualização: mensagem do usuário + placeholder da IA (evita duplicar o texto do usuário)
    setChats((prevChats) => {
      const newChats = prevChats.map((chat) => {
        if (chat.id !== currentChatId) return chat;
        return {
          ...chat,
          messages: [
            ...chat.messages,
            { text: textToSend, type: "user" },
            { text: "", type: "assistant", streaming: true },
          ],
        };
      });
      localStorage.setItem("chat_history", JSON.stringify(newChats));
      return newChats;
    });

    const apiUrl =
      window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost"
        ? "http://127.0.0.1:5001/api/chat"
        : "/api/chat";

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: textToSend, stream: true }),
      });

      const ct = response.headers.get("content-type") || "";

      if (!response.ok && !ct.includes("text/event-stream")) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.response || errData.error || `Erro ${response.status}`);
      }

      if (!response.body) {
        throw new Error("Resposta sem corpo");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      const applySsePayload = (data) => {
        if (data.error) {
          throw new Error(data.error);
        }
        if (data.text) {
          fullText += data.text;
          setChats((prevChats) => {
            const newChats = prevChats.map((chat) => {
              if (chat.id !== currentChatId) return chat;
              const msgs = chat.messages.map((m, idx) =>
                idx === chat.messages.length - 1 && m.type === "assistant" && m.streaming
                  ? { ...m, text: fullText }
                  : m
              );
              return { ...chat, messages: msgs };
            });
            localStorage.setItem("chat_history", JSON.stringify(newChats));
            return newChats;
          });
        }
      };

      const consumeCompleteSseBlocks = (raw) => {
        const normalized = raw.replace(/\r\n/g, "\n");
        const parts = normalized.split("\n\n");
        const complete = parts.slice(0, -1);
        const tail = parts[parts.length - 1] ?? "";
        for (const block of complete) {
          const line = block.trim();
          if (!line.startsWith("data: ")) continue;
          let data;
          try {
            data = JSON.parse(line.slice(6));
          } catch {
            continue;
          }
          applySsePayload(data);
        }
        return tail;
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        buffer = consumeCompleteSseBlocks(buffer);
      }

      // Último evento pode vir sem "\n\n" no fim do stream
      if (buffer.trim()) {
        const tail = buffer.replace(/\r\n/g, "\n").trim();
        for (const line of tail.split("\n")) {
          const t = line.trim();
          if (!t.startsWith("data: ")) continue;
          let data;
          try {
            data = JSON.parse(t.slice(6));
          } catch {
            continue;
          }
          applySsePayload(data);
        }
      }

      setChats((prevChats) => {
        const newChats = prevChats.map((chat) => {
          if (chat.id !== currentChatId) return chat;
          let newTitle = chat.title;
          const userOnly = chat.messages.filter((m) => m.type === "user");
          if (userOnly.length === 1 && chat.title === "Nova conversa") {
            const words = textToSend.split(" ").slice(0, 4).join(" ");
            newTitle = words + (textToSend.split(" ").length > 4 ? "..." : "");
          }
          const msgs = chat.messages.map((m, idx) =>
            idx === chat.messages.length - 1 && m.type === "assistant"
              ? { text: fullText || m.text || "Sem resposta.", type: "assistant" }
              : m
          );
          return { ...chat, title: newTitle, messages: msgs };
        });
        localStorage.setItem("chat_history", JSON.stringify(newChats));
        return newChats;
      });
    } catch (error) {
      setChats((prevChats) => {
        const newChats = prevChats.map((chat) => {
          if (chat.id !== currentChatId) return chat;
          const withoutStreaming = chat.messages.filter((m) => !(m.type === "assistant" && m.streaming));
          return {
            ...chat,
            messages: [
              ...withoutStreaming,
              {
                text:
                  error.message ||
                  "Erro de conexão. Verifique se o servidor está rodando.",
                type: "assistant",
              },
            ],
          };
        });
        localStorage.setItem("chat_history", JSON.stringify(newChats));
        return newChats;
      });
    } finally {
      setIsLoading(false);
      setLoadingChatId(null);
      sendInFlightRef.current = false;
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickPrompt = (prompt, sendDirect = false) => {
    if (sendDirect) {
      handleSend(prompt);
      return;
    }
    setInputText(prompt);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  const quickBubbles = (
    <div className="quick-bubbles" role="group" aria-label="Opções rápidas de recomendação">
      {QUICK_PROMPT_OPTIONS.map((option) => (
        <div className="quick-bubble" key={option.label}>
          <button
            className="quick-bubble-edit"
            onClick={() => handleQuickPrompt(option.prompt, false)}
            title="Selecionar para editar"
            disabled={isLoading}
          >
            {option.label}
          </button>
        </div>
      ))}
    </div>
  );

  const activeChat = chats.find(c => c.id === activeChatId);
  const showWelcome = chats.length === 0 || (activeChat && activeChat.messages.length === 0);

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <img src={logo} alt="Logo EratoChat" className="logo-img" />
          </div>
          <span className="logo-titulo">EratoChat</span>
        </div>

        <div className="sidebar-actions">
          <button className="btn-new-chat" onClick={createNewChat}>
            <span className="material-symbols-rounded">add</span>
            Nova conversa
          </button>
        </div>

        <div className="sidebar-scrollable">
          <div className="chat-list-container">
            {chats.length === 0 && (
              <>
                <p className="empty-state-text">Nenhuma conversa ainda. Comece uma nova!</p>
              </>
            )}
            <ul className="chat-list">
              {chats.map(chat => (
                <li 
                  key={chat.id} 
                  className={`chat-item ${chat.id === activeChatId ? 'active' : ''}`}
                  onClick={() => setActiveChatId(chat.id)}
                >
                  <div className="chat-item-text">
                    <span className="material-symbols-rounded" style={{fontSize: '18px'}}>chat_bubble</span>
                    {chat.title}
                  </div>
                  <div className="chat-item-actions">
                    <button 
                      className="btn-icon-small" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenDropdownId(openDropdownId === chat.id ? null : chat.id);
                      }}
                    >
                      <span className="material-symbols-rounded">more_horiz</span>
                    </button>
                    <div className={`chat-dropdown ${openDropdownId === chat.id ? 'show' : ''}`}>
                      <button className="dropdown-item" onClick={(e) => deleteChat(chat.id, e)}>
                        <span className="material-symbols-rounded">delete</span>
                        Apagar chat
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="sidebar-footer">
          <button className="btn-config" onClick={() => setIsConfigOpen(true)}>
            <span className="material-symbols-rounded">settings</span>
            Configurações
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <main className="main">
        {!showWelcome && (
          <header className="topbar">
            <h1 className="current-chat-title">{activeChat ? activeChat.title : "Nova conversa"}</h1>
          </header>
        )}

        {showWelcome ? (
          <section className="tela-boas-vindas">
            <div className="boas-vindas-icone">
              <img src={logo} alt="Logo EratoChat" className="boas-vindas-logo" />
            </div>
            <h2 className="boas-vindas-titulo">O que quer assistir ou ler?</h2>
            <p className="boas-vindas-subtitulo">
              Sou <span>{agentName}</span>, especialista em recomendar filmes, séries e livros de todos os gêneros e épocas.
            </p>
            
            <div className="suggestion-cards">
              <div className="suggestion-card" onClick={() => handleSend('Recomende filmes de ficção científica dos anos 90')}>
                <span className="material-symbols-rounded card-icon" style={{color: '#60a5fa'}}>movie</span>
                <p>Recomende filmes de ficção científica dos anos 90</p>
              </div>
              <div className="suggestion-card" onClick={() => handleSend('Melhores séries de suspense lançadas após 2018')}>
                <span className="material-symbols-rounded card-icon" style={{color: '#c084fc'}}>tv</span>
                <p>Melhores séries de suspense lançadas após 2018</p>
              </div>
              <div className="suggestion-card" onClick={() => handleSend('Livros de fantasia clássicos para iniciantes')}>
                <span className="material-symbols-rounded card-icon" style={{color: '#4ade80'}}>menu_book</span>
                <p>Livros de fantasia clássicos para iniciantes</p>
              </div>
            </div>
          </section>
        ) : (
          <section className="chat-wrapper">
            <div className="chat-messages">
              {activeChat && activeChat.messages.map((msg, idx) => {
                const isUser = msg.type === 'user';
                const normalizedAssistantText = formatAssistantRecommendations(msg.text);
                const assistantBody =
                  msg.streaming && !msg.text?.trim()
                    ? "<p class=\"streaming-hint\">Gerando recomendações...</p>"
                    : DOMPurify.sanitize(marked.parse(normalizedAssistantText));
                return (
                  <div key={idx} className={`message-row ${msg.type}`}>
                    <div className={`avatar ${isUser ? 'user-avatar' : 'ai-avatar'}`}>
                      {isUser ? (
                        <span className="material-symbols-rounded" style={{fontSize: '20px'}}>person</span>
                      ) : (
                        <img src={logo} alt="Logo EratoChat" className="avatar-logo" />
                      )}
                    </div>
                    <div className="message-bubble">
                      <span className="author-name">{isUser ? 'Você' : agentName}</span>
                      {isUser ? (
                        <div className="message-text"><p>{msg.text}</p></div>
                      ) : (
                        <div className="message-text" dangerouslySetInnerHTML={{ __html: assistantBody }} />
                      )}
                    </div>
                  </div>
                );
              })}
              
              {isLoading && activeChat && loadingChatId === activeChat.id && !activeChat.messages.some((m) => m.streaming) && (
                <div className="message-row assistant temp-loading">
                  <div className="avatar ai-avatar">
                    <img src={logo} alt="Logo EratoChat" className="avatar-logo" />
                  </div>
                  <div className="message-bubble">
                    <span className="author-name">{agentName}</span>
                    <div className="message-text"><p>Pesquisando no acervo...</p></div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </section>
        )}

        <div className="input-container">
          {!showWelcome && quickBubbles}

          <div className="input-area">
            <div className="input-inner">
              <textarea 
                ref={inputRef}
                rows="1" 
                placeholder="Pergunte sobre filmes, séries ou livros..."
                value={inputText}
                maxLength={MAX_INPUT_CHARS}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button className="btn-send" onClick={() => handleSend()} disabled={isLoading || !inputText.trim()}>
                <span className="material-symbols-rounded">arrow_upward</span>
              </button>
            </div>
          </div>
          <div className="footer-disclaimer">
            Especialista em filmes, séries e livros. As informações podem variar.
          </div>
        </div>
      </main>

      {/* Settings Modal */}
      <div className={`config-overlay ${isConfigOpen ? 'show' : ''}`} onClick={() => setIsConfigOpen(false)}>
        <div className="config-modal" onClick={e => e.stopPropagation()}>
          <div className="config-header">
            <h2>Configurações</h2>
            <button className="btn-fechar-config" onClick={() => setIsConfigOpen(false)}>
              <span className="material-symbols-rounded">close</span>
            </button>
          </div>
          <div className="config-body">
            <div className="config-secao">
              <label className="config-label">
                <span className="material-symbols-rounded">palette</span> Tema da Interface
              </label>
              <div className="tema-opcoes">
                <div className={`tema-card ${temaAtual === 'theme-azul-marinho' ? 'active' : ''}`} onClick={() => setTemaAtual('theme-azul-marinho')}>
                  <div className="tema-preview" style={{background: '#0a1128'}}>
                    <div style={{background: '#1e293b'}}></div>
                    <div style={{background: '#3b82f6'}}></div>
                  </div>
                  <span>Azul Marinho</span>
                  <span className="material-symbols-rounded check-icon">check_circle</span>
                </div>
                <div className={`tema-card ${temaAtual === 'theme-preto-profundo' ? 'active' : ''}`} onClick={() => setTemaAtual('theme-preto-profundo')}>
                  <div className="tema-preview" style={{background: '#000000'}}>
                    <div style={{background: '#111111'}}></div>
                    <div style={{background: '#333333'}}></div>
                  </div>
                  <span>Preto Profundo</span>
                  <span className="material-symbols-rounded check-icon">check_circle</span>
                </div>
                <div className={`tema-card ${temaAtual === 'theme-branco-adaptativo' ? 'active' : ''}`} onClick={() => setTemaAtual('theme-branco-adaptativo')}>
                  <div className="tema-preview" style={{background: '#ffffff', border: '1px solid #e2e8f0'}}>
                    <div style={{background: '#f1f5f9'}}></div>
                    <div style={{background: '#0f172a'}}></div>
                  </div>
                  <span>Branco Suave</span>
                  <span className="material-symbols-rounded check-icon">check_circle</span>
                </div>
                <div className={`tema-card ${temaAtual === 'theme-ceu-estrelado' ? 'active' : ''}`} onClick={() => setTemaAtual('theme-ceu-estrelado')}>
                  <div className="tema-preview" style={{background: '#090616', border: '1px solid rgba(139, 92, 246, 0.3)'}}>
                    <div style={{background: '#110d24'}}></div>
                    <div style={{background: '#8b5cf6'}}></div>
                  </div>
                  <span>Céu Estrelado</span>
                  <span className="material-symbols-rounded check-icon">check_circle</span>
                </div>
              </div>
            </div>

            <div className="config-secao">
              <label className="config-label">
                <span className="material-symbols-rounded">smart_toy</span> Nome do Agente
              </label>
              <div className="input-group">
                <input 
                  type="text" 
                  value={agentName} 
                  onChange={(e) => {
                    setAgentName(e.target.value);
                    localStorage.setItem("agent_name", e.target.value);
                  }}
                  className="config-input" 
                />
              </div>
              <p className="config-hint">Este nome aparecerá na interface e nas respostas da IA.</p>
            </div>

            <div className="config-secao excluir-secao">
              <label className="config-label excluir-label">
                <span className="material-symbols-rounded">delete</span> Apagar Dados
              </label>
              <p className="config-hint excluir-alerta">Atenção: esta ação apagará todos os chats já feitos e não poderá ser desfeita.</p>
              <button className="btn-danger" onClick={deleteAllChats}>
                <span className="material-symbols-rounded">delete</span> Apagar todas as conversas
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;