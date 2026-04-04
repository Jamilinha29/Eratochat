import React, { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

function App() {
  const [agentName, setAgentName] = useState(() => localStorage.getItem("agent_name") || "Nova AI");
  const [currentTheme, setCurrentTheme] = useState(() => localStorage.getItem("app_theme") || "theme-azul-marinho");
  const [chats, setChats] = useState(() => JSON.parse(localStorage.getItem("chat_history")) || []);
  const [activeChatId, setActiveChatId] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Apply theme to body
  useEffect(() => {
    document.body.className = currentTheme;
    localStorage.setItem("app_theme", currentTheme);
  }, [currentTheme]);

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
      setIsSettingsOpen(false);
    }
  };

  const handleSend = async (overrideText) => {
    const textToSend = typeof overrideText === 'string' ? overrideText : inputText.trim();
    if (!textToSend || isLoading) return;

    let currentChatId = activeChatId;
    if (!currentChatId) {
      currentChatId = "chat_" + Date.now();
      const newChat = { id: currentChatId, title: "Nova conversa", messages: [] };
      setChats(prev => [newChat, ...prev]);
      setActiveChatId(currentChatId);
    }

    // Add user message
    setChats(prevChats => {
      const newChats = prevChats.map(chat => {
        if (chat.id === currentChatId) {
          return {
            ...chat,
            messages: [...chat.messages, { text: textToSend, type: 'user' }]
          };
        }
        return chat;
      });
      localStorage.setItem("chat_history", JSON.stringify(newChats));
      return newChats;
    });

    setInputText("");
    setIsLoading(true);

    // Call API
    try {
      const apiUrl = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost"
        ? "http://127.0.0.1:5001/api/chat"
        : "/api/chat";

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: textToSend, session_id: currentChatId }),
      });

      const data = await response.json();

      setChats(prevChats => {
        const newChats = prevChats.map(chat => {
          if (chat.id === currentChatId) {
            let newTitle = chat.title;
            if (chat.messages.length === 1 && chat.title === "Nova conversa") {
              const words = textToSend.split(" ").slice(0, 4).join(" ");
              newTitle = words + (textToSend.split(" ").length > 4 ? "..." : "");
            }
            if (response.ok) {
              return { ...chat, title: newTitle, messages: [...chat.messages, { text: data.response, type: 'assistant' }] };
            } else {
              return { ...chat, title: newTitle, messages: [...chat.messages, { text: data.response || data.error || "Erro Desconhecido", type: 'assistant' }] };
            }
          }
          return chat;
        });
        localStorage.setItem("chat_history", JSON.stringify(newChats));
        return newChats;
      });

    } catch (error) {
      setChats(prevChats => {
        const newChats = prevChats.map(chat => {
          if (chat.id === currentChatId) {
            return { ...chat, messages: [...chat.messages, { text: "Erro de conexão. Verifique se o servidor está rodando.", type: 'assistant' }] };
          }
          return chat;
        });
        localStorage.setItem("chat_history", JSON.stringify(newChats));
        return newChats;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const activeChat = chats.find(c => c.id === activeChatId);
  const showWelcome = chats.length === 0 || (activeChat && activeChat.messages.length === 0);

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo-circle">
            <span className="material-symbols-rounded">local_florist</span>
          </div>
          <span className="logo-title">EratoChat</span>
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
              <p className="empty-state-text">Nenhuma conversa ainda. Comece uma nova!</p>
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
          <button className="btn-settings" onClick={() => setIsSettingsOpen(true)}>
            <span className="material-symbols-rounded">settings</span>
            Configurações
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <main className="main">
        <header className="topbar">
          <h1 className="current-chat-title">{activeChat ? activeChat.title : "Nova conversa"}</h1>
        </header>

        {showWelcome ? (
          <section className="welcome-screen">
            <div className="welcome-icon">
              <span className="material-symbols-rounded">local_florist</span>
            </div>
            <h2 className="welcome-title">O que quer assistir ou ler?</h2>
            <p className="welcome-subtitle">
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
                const contentHtml = isUser ? `<p>${msg.text}</p>` : DOMPurify.sanitize(marked.parse(msg.text));
                return (
                  <div key={idx} className={`message-row ${msg.type}`}>
                    <div className={`avatar ${isUser ? 'user-avatar' : 'ai-avatar'}`}>
                      <span className="material-symbols-rounded" style={{fontSize: '20px'}}>
                        {isUser ? 'person' : 'local_florist'}
                      </span>
                    </div>
                    <div className="message-bubble">
                      <span className="author-name">{isUser ? 'Você' : agentName}</span>
                      <div className="message-text" dangerouslySetInnerHTML={{ __html: contentHtml }} />
                    </div>
                  </div>
                );
              })}
              
              {isLoading && (
                <div className="message-row assistant temp-loading">
                  <div className="avatar ai-avatar">
                    <span className="material-symbols-rounded" style={{fontSize: '20px'}}>local_florist</span>
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
          <div className="input-area">
            <div className="input-inner">
              <textarea 
                ref={inputRef}
                rows="1" 
                placeholder="Pergunte sobre filmes, séries ou livros..."
                value={inputText}
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
      <div className={`modal-overlay ${isSettingsOpen ? 'show' : ''}`} onClick={() => setIsSettingsOpen(false)}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Configurações</h2>
            <button className="btn-close-modal" onClick={() => setIsSettingsOpen(false)}>
              <span className="material-symbols-rounded">close</span>
            </button>
          </div>
          <div className="modal-body">
            <div className="settings-section">
              <label className="settings-label">
                <span className="material-symbols-rounded">palette</span> Tema da Interface
              </label>
              <div className="theme-options">
                <div className={`theme-card ${currentTheme === 'theme-azul-marinho' ? 'active' : ''}`} onClick={() => setCurrentTheme('theme-azul-marinho')}>
                  <div className="theme-preview" style={{background: '#0a1128'}}>
                    <div style={{background: '#1e293b'}}></div>
                    <div style={{background: '#3b82f6'}}></div>
                  </div>
                  <span>Azul Marinho</span>
                  <span className="material-symbols-rounded check-icon">check_circle</span>
                </div>
                <div className={`theme-card ${currentTheme === 'theme-preto-profundo' ? 'active' : ''}`} onClick={() => setCurrentTheme('theme-preto-profundo')}>
                  <div className="theme-preview" style={{background: '#000000'}}>
                    <div style={{background: '#111111'}}></div>
                    <div style={{background: '#333333'}}></div>
                  </div>
                  <span>Preto Profundo</span>
                  <span className="material-symbols-rounded check-icon">check_circle</span>
                </div>
                <div className={`theme-card ${currentTheme === 'theme-branco-adaptativo' ? 'active' : ''}`} onClick={() => setCurrentTheme('theme-branco-adaptativo')}>
                  <div className="theme-preview" style={{background: '#ffffff', border: '1px solid #e2e8f0'}}>
                    <div style={{background: '#f1f5f9'}}></div>
                    <div style={{background: '#0f172a'}}></div>
                  </div>
                  <span style={{color: '#333'}}>Branco Suave</span>
                  <span className="material-symbols-rounded check-icon">check_circle</span>
                </div>
                <div className={`theme-card ${currentTheme === 'theme-ceu-estrelado' ? 'active' : ''}`} onClick={() => setCurrentTheme('theme-ceu-estrelado')}>
                  <div className="theme-preview" style={{background: '#090616', border: '1px solid rgba(139, 92, 246, 0.3)'}}>
                    <div style={{background: '#110d24'}}></div>
                    <div style={{background: '#8b5cf6'}}></div>
                  </div>
                  <span>Céu Estrelado</span>
                  <span className="material-symbols-rounded check-icon">check_circle</span>
                </div>
              </div>
            </div>

            <div className="settings-section">
              <label className="settings-label">
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
                  className="settings-input" 
                />
              </div>
              <p className="settings-hint">Este nome aparecerá na interface e nas respostas da IA.</p>
            </div>

            <div className="settings-section delete-section">
              <label className="settings-label delete-label">
                <span className="material-symbols-rounded">delete</span> Apagar Dados
              </label>
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