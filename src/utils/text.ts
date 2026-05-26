export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function formatCompletedTaskMessage(title: string, description: string): string {
  return `*Tarefa Concluída*\n${title}\n\n${description || "Sem descrição."}`;
}
