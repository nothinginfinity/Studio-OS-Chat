import { Sidebar } from "./components/Sidebar";
import { ChatWindow } from "./components/ChatWindow";
import { useChat } from "./hooks/useChat";

export default function App() {
  const { messages, settings, setSettings, sendMessage, clearChat, isLoading, error } = useChat();

  return (
    <div className="app-shell">
      <Sidebar settings={settings} setSettings={setSettings} onClearChat={clearChat} />
      <ChatWindow messages={messages} onSend={sendMessage} isLoading={isLoading} error={error} />
    </div>
  );
}
