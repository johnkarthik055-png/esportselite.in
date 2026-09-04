import { Bot, Lock, Sparkles } from 'lucide-react'

/*
 * AICoachPanel — contextual coach card for roadmap screens.
 *
 * STRUCTURE ONLY. The AI Coach backend (aiCoachChat Cloud Function) is not
 * deployed — it needs Firebase Blaze, which is currently blocked. So this
 * panel shows an honest "unlocks once available" state and never fakes a
 * response or a chat.
 *
 * Wiring it up later is a small change, not a rebuild:
 *   <AICoachPanel
 *     enabled={coachReady}
 *     context={{ area:'role-detail', roleId:'entry-fragger', ... }}
 *     suggestions={['How do I stay trade-able?', ...]}
 *     onAsk={(prompt, context) => coach.send(prompt, context)}
 *   />
 * When `enabled` is true the same layout renders the real ask box / answer.
 *
 * `context` is passed through untouched so the future backend gets exactly
 * what screen the question came from.
 */
export default function AICoachPanel({
  enabled = false,
  context = null,
  title = 'AI Coach',
  blurb,
  suggestions = [],
  onAsk,
  compact = false,
}) {
  const defaultBlurb = compact
    ? 'AI Coach unlocks once available.'
    : 'Personalised coaching for this screen unlocks once the AI Coach is available. ' +
      'Nothing here is auto-generated — no fake answers, no fake chat.'

  return (
    <div className={`aicp ${compact ? 'aicp--compact' : ''} ${enabled ? 'is-enabled' : 'is-locked'}`}>
      <div className="aicp-head">
        <span className="aicp-icon">{enabled ? <Bot size={14} /> : <Lock size={12} />}</span>
        <span className="aicp-title">{title}</span>
        {!enabled && <span className="aicp-flag">Coming soon</span>}
      </div>

      <p className="aicp-blurb">{blurb || defaultBlurb}</p>

      {suggestions.length > 0 && (
        <div className="aicp-suggestions">
          <span className="aicp-suggestions-label">
            <Sparkles size={11} /> You&apos;ll be able to ask
          </span>
          <ul>
            {suggestions.map((s, i) => (
              <li key={i}>
                <button
                  type="button"
                  className="aicp-chip"
                  disabled={!enabled}
                  onClick={enabled && onAsk ? () => onAsk(s, context) : undefined}
                  title={enabled ? undefined : 'AI Coach not available yet'}
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {enabled && onAsk && (
        <AskBox onAsk={(v) => onAsk(v, context)} />
      )}

      <style>{styles}</style>
    </div>
  )
}

/* Real ask box — only rendered once `enabled`. Kept trivial on purpose;
   the future backend owns the response rendering. */
function AskBox({ onAsk }) {
  return (
    <form
      className="aicp-ask"
      onSubmit={(e) => {
        e.preventDefault()
        const v = e.currentTarget.elements.q.value.trim()
        if (v) { onAsk(v); e.currentTarget.reset() }
      }}
    >
      <input name="q" className="input" placeholder="Ask the coach about this…" />
      <button className="btn btn-primary btn-sm" type="submit">Ask</button>
    </form>
  )
}

const styles = `
  .aicp {
    background: linear-gradient(160deg, rgba(124,58,237,0.10), rgba(59,130,246,0.05));
    border: 1px solid rgba(124,58,237,0.25);
    border-radius: var(--radius);
    padding: 14px;
  }
  .aicp--compact { padding: 11px 12px; }
  .aicp-head { display: flex; align-items: center; gap: 7px; margin-bottom: 8px; }
  .aicp-icon {
    width: 22px; height: 22px; flex-shrink: 0; border-radius: 6px;
    background: rgba(124,58,237,0.15); color: var(--violet);
    display: flex; align-items: center; justify-content: center;
  }
  .aicp-title {
    font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 11.5px;
    letter-spacing: 0.05em; text-transform: uppercase; color: var(--violet);
  }
  .aicp-flag {
    margin-left: auto;
    font-family: 'DM Sans', sans-serif; font-size: 9px; font-weight: 600;
    letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-subtle);
    border: 1px solid var(--border); border-radius: 999px; padding: 2px 7px;
  }
  .aicp-blurb {
    font-family: 'DM Sans', sans-serif; font-size: 12px; line-height: 1.6;
    color: var(--text-subtle); margin: 0;
  }
  .aicp--compact .aicp-blurb { font-size: 11.5px; }

  .aicp-suggestions { margin-top: 10px; }
  .aicp-suggestions-label {
    display: inline-flex; align-items: center; gap: 5px; margin-bottom: 7px;
    font-family: 'DM Sans', sans-serif; font-size: 10px; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--text-subtle);
  }
  .aicp-suggestions ul { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
  .aicp-chip {
    background: var(--bg-elevated); border: 1px solid var(--border);
    border-radius: 999px; padding: 5px 10px; cursor: default;
    font-family: 'DM Sans', sans-serif; font-size: 11px; color: var(--text-muted);
    text-align: left;
  }
  .aicp.is-enabled .aicp-chip { cursor: pointer; }
  .aicp.is-enabled .aicp-chip:hover { border-color: var(--violet); color: var(--text-primary); }
  .aicp-chip:disabled { opacity: 0.75; }

  .aicp-ask { display: flex; gap: 8px; margin-top: 10px; }
  .aicp-ask .input { flex: 1; }
`
