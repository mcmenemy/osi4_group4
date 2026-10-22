import { useState, type FormEvent } from 'react'

const MAX_CHARS = 2000

// The original stack-test demo. Reachable at #/scifi; not in the main nav.
export default function ScifiPage() {
  const [text, setText] = useState('')
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setResult('')
    try {
      const response = await fetch('/api/scifi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(typeof data.detail === 'string' ? data.detail : 'Request failed.')
      }
      setResult(data.scifi)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container narrow tab">
      <h1>10x Sci-Fi</h1>
      <p className="tagline">Type anything. Get it back ten times more science fiction.</p>

      <form onSubmit={handleSubmit}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="I walked my dog to the coffee shop this morning."
          maxLength={MAX_CHARS}
          rows={5}
        />
        <div className="row">
          <span className="count">
            {text.length} / {MAX_CHARS}
          </span>
          <button type="submit" disabled={loading || !text.trim()}>
            {loading ? 'Warping…' : 'Make it sci-fi'}
          </button>
        </div>
      </form>

      {error && <p className="error">{error}</p>}
      {result && <article className="result">{result}</article>}
    </div>
  )
}
