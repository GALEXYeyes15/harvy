import { AddFontsApp } from "./components/AddFontsApp";
import { AppShell } from "./components/AppShell";
import { NotesPopoutApp } from "./components/NotesPopoutApp";
import { isAddFontsWindow } from "./features/fonts/addFontsPopout";
import { isNotesPopoutWindow } from "./features/notes/notesPopout";

export default function App() {
  if (isNotesPopoutWindow()) {
    return <NotesPopoutApp />;
  }
  if (isAddFontsWindow()) {
    return <AddFontsApp />;
  }
  return <AppShell />;
}
