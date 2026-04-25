import { useState, useRef } from "react";
import type { ChatSettings, ChatSession, ChatExportRef } from "../lib/types";
import type { UseSpaceMailboxResult } from "../hooks/useSpaceMailbox";
import { ModelSelector } from "./ModelSelector";
import { SessionTitleEditor } from "./SessionTitleEditor";
import { FilesPanel } from "./FilesPanel";
import { OllamaStatus } from "./OllamaStatus";
import ProviderSettings from "./ProviderSettings";
import { IngestDropZone } from "./IngestDropZone";
import { ExportChatButton } from "./ExportChatButton";
import { GitHubSettings } from "./GitHubSettings";
import { SpacesPanel } from "./SpacesPanel";
import { PromptHistorySheet } from "./PromptHistorySheet";
import { PromptLibrary } from "./PromptLibrary";
import { ChatActionSheet } from "./ChatActionSheet";
import { SystemPromptLibrarySheet } from "./SystemPromptLibrarySheet";
import { useLongPress } from "../hooks/useLongPress";

type Tab = "chats" | "library" | "files" | "spaces" | "settings";

interface SidebarProps {
  settings: ChatSettings;
  setSettings: React.Dispatch<React.SetStateAction<ChatSettings>>;
  onClearChat: () => void;
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onRenameSession: (id: string, title: string) => void;
  onSessionExported: (sessionId: string, exportRef: ChatExportRef) => void;
  onInsertPrompt?: (content: string) => void;
  onReusePrompt: (text: string) => void;
  onCreateSessionWithDraft: (text: string) => Promise<unknown>;
  onDeleteSession?: (sessionId: string) => void;
  activeTab?: Tab;
  onTabChange?: (tab: Tab) => void;
  /** Phase 4 / Space mailbox wired from App.tsx */
  spaceMailbox?: UseSpaceMailboxResult;
}
