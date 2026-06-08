import nspell from "nspell";

type HunspellChecker = ReturnType<typeof nspell>;

const HUNSPELL_AFF_PATH = "/hunspell/en_US.aff";
const HUNSPELL_DIC_PATH = "/hunspell/en_US.dic";

let spell: HunspellChecker | null = null;
let loadPromise: Promise<void> | null = null;

async function loadHunspellInBrowser(): Promise<void> {
  const [aff, dic] = await Promise.all([
    fetch(HUNSPELL_AFF_PATH).then((res) => {
      if (!res.ok) throw new Error(`Failed to fetch ${HUNSPELL_AFF_PATH} (${res.status})`);
      return res.text();
    }),
    fetch(HUNSPELL_DIC_PATH).then((res) => {
      if (!res.ok) throw new Error(`Failed to fetch ${HUNSPELL_DIC_PATH} (${res.status})`);
      return res.text();
    }),
  ]);

  spell = nspell(aff, dic);
}

async function loadHunspellInNode(): Promise<void> {
  const { readFile } = await import("node:fs/promises");
  const { dirname, join } = await import("node:path");
  const { fileURLToPath } = await import("node:url");

  const root = join(dirname(fileURLToPath(import.meta.url)), "../../../../");
  const dictDir = join(root, "node_modules", "dictionary-en-us");
  const [aff, dic] = await Promise.all([
    readFile(join(dictDir, "index.aff"), "utf8"),
    readFile(join(dictDir, "index.dic"), "utf8"),
  ]);

  spell = nspell(aff, dic);
}

/** Load en_US Hunspell dictionary (browser fetch or Node fs). Safe to call repeatedly. */
export function ensureHunspellLoaded(): Promise<void> {
  if (spell) return Promise.resolve();
  if (!loadPromise) {
    const loader =
      typeof window !== "undefined" ? loadHunspellInBrowser() : loadHunspellInNode();
    loadPromise = loader.catch((err: unknown) => {
      loadPromise = null;
      console.error("[HarvyHunspell] Failed to load Hunspell dictionary", err);
      throw err;
    });
  }
  return loadPromise;
}

export function isHunspellReady(): boolean {
  return spell !== null;
}

export function getHunspell(): HunspellChecker | null {
  return spell;
}
