import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "../save/saveRuntime";
import type { GeneratedTwitterCollection } from "./formatGeneratedOutputs";
import type { TwitterFormatGenerationResult } from "./formatGenerationTypes";
import { tweetItemsFromGeneration } from "./formatGeneratedOutputs";
import { parseTwitterFormatGenerationResult } from "./generation/parseTwitterFormatResult";
import type { TweetItem } from "./tweetCollection";

const STORAGE_PREFIX = "harvy-format-outputs:";

function toGenerationResult(collection: GeneratedTwitterCollection): TwitterFormatGenerationResult {
  return {
    platform: "twitter",
    type: "collection",
    title: collection.title,
    items: collection.tweets.map((tweet) => ({
      id: tweet.id,
      text: tweet.text,
      status:
        tweet.status === "edited" ||
        tweet.status === "favorite" ||
        tweet.status === "published"
          ? tweet.status
          : "draft",
      favorite: tweet.status === "favorite",
    })),
  };
}

function readWebStoredTwitterCollection(documentKey: string): GeneratedTwitterCollection | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${documentKey}`);
    if (!raw) return null;
    const parsed = parseTwitterFormatGenerationResult(JSON.parse(raw));
    return tweetItemsFromGeneration(parsed);
  } catch {
    return null;
  }
}

function writeWebStoredTwitterCollection(
  documentKey: string,
  collection: GeneratedTwitterCollection,
): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(
    `${STORAGE_PREFIX}${documentKey}`,
    JSON.stringify(toGenerationResult(collection)),
  );
}

export async function loadPersistedTwitterFormats(
  documentId: string | null,
  essayTitle: string,
): Promise<GeneratedTwitterCollection | null> {
  if (isTauriRuntime()) {
    try {
      const result = await invoke<TwitterFormatGenerationResult | null>("load_twitter_formats", {
        documentId: documentId ?? null,
        essayTitle,
      });
      if (!result) return null;
      return tweetItemsFromGeneration(result);
    } catch {
      return null;
    }
  }

  const key = documentId?.trim() || essayTitle.trim() || "scratch";
  return readWebStoredTwitterCollection(key);
}

export async function savePersistedTwitterFormats(
  documentId: string | null,
  essayTitle: string,
  collection: GeneratedTwitterCollection,
): Promise<void> {
  if (isTauriRuntime()) {
    await invoke("save_twitter_formats", {
      documentId: documentId ?? null,
      essayTitle,
      collection: toGenerationResult(collection),
    });
    return;
  }

  const key = documentId?.trim() || essayTitle.trim() || "scratch";
  writeWebStoredTwitterCollection(key, collection);
}

export function tweetsToGeneratedCollection(tweets: TweetItem[]): GeneratedTwitterCollection {
  return {
    title: `Tweets — ${tweets.length} generated`,
    tweets,
  };
}
