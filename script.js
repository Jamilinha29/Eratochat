const messagesContainer = document.getElementById("chat-messages");
const input = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

function addMessage(text, type) {
  const wrapper = document.createElement("div");
  wrapper.className = `chat-message ${type}`;
  const avatar = type === 'user' ? '👤' : '🎬';
  const author = type === 'user' ? 'Você' : 'CineChat';
  
  wrapper.innerHTML = `
    <div class="message-avatar">${avatar}</div>
    <div class="message-content">
      <div class="message-header"><span class="message-author">${author}</span></div>
      <p>${text}</p>
    </div>
  `;
  messagesContainer.appendChild(wrapper);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function handleSend() {
  const text = input.value.trim();
  if (!text) return;

  addMessage(text, 'user');
  input.value = "";

  const loadingMsg = "Digitando...";

  try {
    
const response = await fetch("http://127.0.0.1:5001/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });

    const data = await response.json();
    addMessage(data.response, 'assistant');
  } catch (error) {
    addMessage("Erro de conexão.", 'assistant');
  }
}

sendBtn.addEventListener("click", handleSend);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});