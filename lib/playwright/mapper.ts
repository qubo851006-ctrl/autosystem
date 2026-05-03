export function applyTemplate(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? '')
}

export function mapStepValue(
  value: string | undefined,
  data: Record<string, string>
): string | undefined {
  if (value === undefined) return undefined
  return applyTemplate(value, data)
}
