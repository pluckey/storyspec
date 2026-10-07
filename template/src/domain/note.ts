// Example entity. Domain types and pure rules live here; nothing in domain imports
// anything outside domain.
export type Note = {
  id: string
  ownerId: string
  title: string
  body: string
  createdAt: string
}

export const TITLE_MAX = 120

// A pure rule shared by any story that accepts a title.
export const titleProblem = (title: string): string | undefined => {
  const t = title.trim()
  if (t.length === 0) return 'Title is required'
  if (t.length > TITLE_MAX) return `Title must be ${TITLE_MAX} characters or fewer`
  return undefined
}
