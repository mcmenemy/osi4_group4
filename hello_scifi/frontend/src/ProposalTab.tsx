import { marked } from 'marked'
import { useEffect, useState } from 'react'

// Renders docs/proposal.md, which the team edits directly in the repo.
export default function ProposalTab() {
  const [html, setHtml] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/proposal')
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((md) => setHtml(marked.parse(md, { async: false })))
      .catch(() => setError("Couldn't load the proposal."))
  }, [])

  return (
    <div className="container narrow tab">
      <p className="kicker">Proposal · draft</p>
      {error && <p className="error">{error}</p>}
      {/* Our own markdown file from the repo, not user input. */}
      <article className="prose" dangerouslySetInnerHTML={{ __html: html }} />
      <p className="muted small">
        Source: <code>docs/proposal.md</code>. Edit it in the repo and redeploy.
      </p>
    </div>
  )
}
