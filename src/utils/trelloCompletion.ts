import { normalizeText } from "./text.js";

export function isDoneListName(listName: string, configuredDoneNames: string[]): boolean {
  const normalizedListName = normalizeText(listName);
  const normalizedDoneNames = new Set(configuredDoneNames.map(normalizeText));

  if (normalizedDoneNames.has(normalizedListName)) {
    return true;
  }

  const listNameParts = normalizedListName
    .split(/[\/|,;>-]+/g)
    .map((part) => part.trim())
    .filter(Boolean);

  return listNameParts.some((part) => normalizedDoneNames.has(part));
}
