// A delivery mechanism: parse the request, call a story, present the result.
// Replace or add others (CLI, Lambda, queue consumer) beside it; stories don't change.
import { createServer } from 'node:http'
import { presentNote, presentNotes, type HttpResponse } from '../presenters/http'
import { compose, type App } from './composition'

export const route = async (app: App, method: string, path: string, memberId: string, body: string): Promise<HttpResponse> => {
  if (method === 'POST' && path === '/notes') {
    const { title = '', body: text = '' } = JSON.parse(body || '{}') as { title?: string; body?: string }
    return presentNote(await app.saveNote({ memberId, title, body: text }))
  }
  if (method === 'GET' && path === '/notes') return presentNotes((await app.listNotes({ memberId })).notes)
  return { status: 404, body: { error: 'Not found' } }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = compose()
  const port = Number(process.env.PORT ?? 3000)
  createServer(async (req, res) => {
    let body = ''
    for await (const chunk of req) body += chunk
    // Demo only: the member comes from a header. A real app puts an auth adapter here.
    const memberId = String(req.headers['x-member-id'] ?? 'demo')
    const out = await route(app, req.method ?? 'GET', req.url ?? '/', memberId, body)
    res.writeHead(out.status, { 'content-type': 'application/json' }).end(JSON.stringify(out.body))
  }).listen(port, () => console.log(`http://localhost:${port}  (POST /notes, GET /notes; header x-member-id)`))
}
