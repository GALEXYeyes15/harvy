import { AppShell } from "./components/AppShell";
import { NotesPopoutApp } from "./components/NotesPopoutApp";
import { isNotesPopoutWindow } from "./features/notes/notesPopout";

export default function App() {
  if (isNotesPopoutWindow()) {
    return <NotesPopoutApp />;
  }
  return <AppShell />;
}
