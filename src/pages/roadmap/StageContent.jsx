import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, Check, Bot, Video, ListChecks, ExternalLink,
  Lightbulb, Clock, Gauge, BookOpen,
} from 'lucide-react'
import { countReadyQuestions } from '../../data/roadmapStages.js'

/*
 * Phase A — CONTENT.
 *
 * Shows the active section's lesson (Stage 1 → "Skill" is the only authored
 * one). The 13 placeholder sections render a clear "coming soon" panel.
 *
 * Right rail: reading-progress ring, in-lesson jump links, per-section Quick
 * Notes (≤300 chars, persisted to Firestore via onSaveNote), and HONEST
 * placeholders for the AI Coach Tip and Related Resources — those systems
 * aren't deployed yet, so we don't fake their content.
 */

const TABS = [
  { id: 'lesson',    label: 'Content' },
  { id: 'keyPoints', label: 'Key Points' },
  { id: 'examples',  label: 'Examples' },
]

const NOTE_MAX = 300

export default function StageContent({
  stage, onSetActiveSection, onViewSection, onSaveNote, onContinue,
}) {
  const navigate = useNavigate()
  const sections = stage.sections || []
  const hasAreaLinks = sections.some(s => s.status === 'elsewhere')
  /* Never auto-land on an "elsewhere" link section. */
  const realSections = sections.filter(s => s.status !== 'elsewhere')
  const activeId = (stage.activeSectionId && sections.some(s => s.id === stage.activeSectionId && s.status !== 'elsewhere'))
    ? stage.activeSectionId
    : realSections[0]?.id
  const section = sections.find(s => s.id === activeId) || realSections[0] || null

  const [tab, setTab] = useState('lesson')
  const [viewedTabs, setViewedTabs] = useState(() => new Set(['lesson']))
  const lessonRef = useRef(null)

  /* Mark the active section viewed once. */
  useEffect(() => {
    if (section?.id) onViewSection(section.id)
    setTab('lesson')
    setViewedTabs(new Set(['lesson']))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section?.id])

  function selectTab(id) {
    setTab(id)
    setViewedTabs(prev => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }

  function jumpTo(linkId) {
    if (linkId === 'key') { selectTab('keyPoints'); return }
    selectTab('lesson')
    /* wait a frame for the lesson tab to render */
    requestAnimationFrame(() => {
      const el = lessonRef.current?.querySelector(`[data-anchor="${linkId}"]`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const ready = section?.status === 'ready' && section.content
  const readingPct = Math.round((viewedTabs.size / TABS.length) * 100)
  const jumpLinks = ready ? (section.content.jumpLinks || []) : []

  /* Compact quick-info strip (Issue 2): why this matters / what you'll
     learn / progress / effort / current level — all derived from real
     stage data, shown BEFORE the full lesson content. */
  const viewedCount = Object.keys(stage.sectionsViewed || {}).length
  const totalRealSections = realSections.length
  const questionCount = countReadyQuestions(stage)
  const effortMin = Math.max(3, Math.round(questionCount * 0.6))
  const previousLevel = stage.result?.overallLevel || null
  const isFirstStage = stage.id === 'know-yourself'

  return (
    <div className="road-grid">
      <div className="road-grid-main">

        {/* Quick info — the "10% reading" summary before the full lesson */}
        <div className="card rmc-quickinfo">
          <div className="rmc-quickinfo-hook">
            <Lightbulb size={14} />
            <span>{section?.tagline || stage.description}</span>
          </div>
          <div className="rmc-quickinfo-grid">
            <div className="rmc-quickinfo-item">
              <BookOpen size={13} />
              <div>
                <div className="rmc-quickinfo-k">What you'll learn</div>
                <div className="rmc-quickinfo-v">{realSections.map(s => s.name).join(' · ') || section?.name}</div>
              </div>
            </div>
            <div className="rmc-quickinfo-item">
              <Gauge size={13} />
              <div>
                <div className="rmc-quickinfo-k">Progress</div>
                <div className="rmc-quickinfo-v">{viewedCount}/{totalRealSections || 1} viewed</div>
              </div>
            </div>
            <div className="rmc-quickinfo-item">
              <Clock size={13} />
              <div>
                <div className="rmc-quickinfo-k">Estimated effort</div>
                <div className="rmc-quickinfo-v">~{effortMin} min · {questionCount} question{questionCount === 1 ? '' : 's'}</div>
              </div>
            </div>
            {previousLevel && (
              <div className="rmc-quickinfo-item">
                <Check size={13} />
                <div>
                  <div className="rmc-quickinfo-k">Your current level</div>
                  <div className="rmc-quickinfo-v">{previousLevel}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section rail */}
        <div className="rmc-rail">
          <div className="rmc-rail-label">
            {hasAreaLinks ? 'This stage covers' : 'Sections in this stage'}
          </div>
          <div className="rmc-rail-pills">
            {sections.map(s => {
              const isReady = s.status === 'ready'
              const isLink = s.status === 'elsewhere'
              return (
                <button
                  key={s.id}
                  className={`rmc-pill ${s.id === activeId ? 'is-active' : ''} ${isReady ? '' : 'is-soon'}`}
                  onClick={() => (isLink && s.linkStage ? navigate(`/roadmap/${s.linkStage}`) : onSetActiveSection(s.id))}
                  title={isLink ? `${s.name} — ${s.linkLabel}` : s.name}
                >
                  {isLink && <ExternalLink size={10} />}
                  {s.name}
                </button>
              )
            })}
          </div>
          {hasAreaLinks && (
            <div className="rmc-rail-note">
              Each area is assessed in its own stage — this one is your starting point.
            </div>
          )}
        </div>

        {section && (
          <div className="card rmc-lesson">
            <div className="rmc-lesson-head">
              <h2 className="rmc-lesson-title">{section.name}</h2>
              {section.tagline && <p className="rmc-lesson-tag">{section.tagline}</p>}
            </div>

            {section.status === 'elsewhere' ? (
              <div className="rmc-soon">
                <ExternalLink size={22} />
                <div className="rmc-soon-title">{section.name} is covered in {section.linkLabel}</div>
                <p className="rmc-soon-body">Open that stage to learn and assess this area.</p>
                {section.linkStage && (
                  <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={() => navigate(`/roadmap/${section.linkStage}`)}>
                    Go to {section.linkLabel} <ArrowRight size={13} />
                  </button>
                )}
              </div>
            ) : ready ? (
              <>
                <p className="rmc-intro">{section.content.intro}</p>

                <div className="rmc-tabs" role="tablist">
                  {TABS.map(t => (
                    <button
                      key={t.id}
                      role="tab"
                      aria-selected={tab === t.id}
                      className={`rmc-tab ${tab === t.id ? 'is-active' : ''}`}
                      onClick={() => selectTab(t.id)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="rmc-tabbody" ref={lessonRef}>
                  {tab === 'lesson' && (section.content.blocks || []).map((b, i) => (
                    <LessonBlock key={i} block={b} />
                  ))}

                  {tab === 'keyPoints' && (
                    <ul className="rmc-keypoints">
                      {(section.content.keyPoints || []).map((p, i) => (
                        <li key={i}><Check size={14} /> <span>{p}</span></li>
                      ))}
                    </ul>
                  )}

                  {tab === 'examples' && <ExamplesTab examples={section.content.examples} />}
                </div>

                {section.content.cta && (
                  <button
                    type="button"
                    className="btn btn-secondary rmc-section-cta"
                    onClick={() => navigate(section.content.cta.to)}
                  >
                    <ExternalLink size={13} /> {section.content.cta.label}
                  </button>
                )}
              </>
            ) : (
              <div className="rmc-soon">
                <ListChecks size={22} />
                <div className="rmc-soon-title">Nothing to read here</div>
                <p className="rmc-soon-body">This section has no lesson content.</p>
              </div>
            )}
          </div>
        )}

        <button className="btn btn-primary rmc-continue" onClick={onContinue}>
          {isFirstStage ? 'Start Your Baseline' : 'Continue to Assessment'} <ArrowRight size={14} />
        </button>
      </div>

      {/* Right rail */}
      <aside className="road-grid-aside">
        <div className="card rmc-side">
          <div className="rmc-side-title">Your Progress</div>
          <div className="rmc-ring-wrap">
            <div className="rmc-ring" style={{ '--pct': readingPct }}>
              <span>{readingPct}%</span>
            </div>
            <div className="rmc-ring-caption">
              {viewedTabs.size} of {TABS.length} lesson tabs viewed
            </div>
          </div>
        </div>

        <div className="card rmc-side">
          <div className="rmc-side-title">In This Lesson</div>
          {jumpLinks.length ? (
            <ul className="rmc-jump">
              {jumpLinks.map(l => (
                <li key={l.id}>
                  <button onClick={() => jumpTo(l.id)}>{l.label}</button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rmc-side-empty">Jump links appear when a lesson is available.</p>
          )}
        </div>

        <QuickNotes
          key={section?.id}
          value={section ? (stage.notes?.[section.id] || '') : ''}
          disabled={!section}
          onSave={(text) => section && onSaveNote(section.id, text)}
        />

        <div className="card rmc-coach">
          <div className="rmc-coach-head"><Bot size={14} /> AI Coach Tip</div>
          <p className="rmc-placeholder">
            Personalised AI Coach tips unlock once the AI Coach goes live. Nothing
            here is auto-generated yet.
          </p>
        </div>

        <div className="card rmc-side">
          <div className="rmc-side-title"><Video size={13} style={{ verticalAlign: '-2px' }} /> Related Resources</div>
          <p className="rmc-placeholder">
            The training video library for this stage isn&apos;t populated yet.
            Video walkthroughs will be linked here as they&apos;re added.
          </p>
        </div>
      </aside>

      <style>{styles}</style>
    </div>
  )
}

function LessonBlock({ block }) {
  switch (block.type) {
    case 'h':
      return <h3 className="rmc-h" data-anchor={block.id || undefined}>{block.text}</h3>
    case 'p':
      return <p className="rmc-p">{block.text}</p>
    case 'quote':
      return <blockquote className="rmc-quote">{block.text}</blockquote>
    case 'callout':
      return (
        <div className="rmc-callout">
          {block.label && <span className="rmc-callout-label">{block.label}</span>}
          <span>{block.text}</span>
        </div>
      )
    case 'checklist':
      return (
        <ul className="rmc-check">
          {block.items.map((it, i) => (
            <li key={i}><Check size={14} /> <span>{it}</span></li>
          ))}
        </ul>
      )
    case 'checklist-detailed':
      return (
        <ul className="rmc-check rmc-check--detailed">
          {block.items.map((it, i) => (
            <li key={i}>
              <Check size={14} />
              <span>
                <strong>{it.text}</strong>
                {it.detail && <em>{it.detail}</em>}
              </span>
            </li>
          ))}
        </ul>
      )
    default:
      return null
  }
}

function ExamplesTab({ examples }) {
  if (!examples || examples.status === 'coming-soon') {
    return (
      <div className="rmc-soon rmc-soon--inline">
        <div className="rmc-soon-title">Examples — to be expanded</div>
        <p className="rmc-soon-body">
          {examples?.note ||
            'Worked examples for this section are still being written.'}
        </p>
      </div>
    )
  }
  return (
    <div className="rmc-examples">
      {(examples.items || []).map((ex, i) => (
        <div key={i} className="rmc-example">
          <div className="rmc-example-title">{ex.title}</div>
          <div className="rmc-example-text">{ex.text}</div>
        </div>
      ))}
    </div>
  )
}

function QuickNotes({ value, disabled, onSave }) {
  const [text, setText] = useState(value || '')
  const timer = useRef(null)

  useEffect(() => { setText(value || '') }, [value])
  useEffect(() => () => clearTimeout(timer.current), [])

  function change(v) {
    const clipped = v.slice(0, NOTE_MAX)
    setText(clipped)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => onSave(clipped), 500)
  }

  return (
    <div className="card rmc-side">
      <div className="rmc-side-title">Quick Notes</div>
      <textarea
        className="input rmc-notes"
        rows={4}
        maxLength={NOTE_MAX}
        placeholder="Jot down anything from this section you want to remember…"
        value={text}
        disabled={disabled}
        onChange={(e) => change(e.target.value)}
      />
      <div className="rmc-notes-foot">
        <span>Saved automatically · visible only to you</span>
        <span>{text.length}/{NOTE_MAX}</span>
      </div>
    </div>
  )
}

const styles = `
  .rmc-quickinfo { display: flex; flex-direction: column; gap: 12px; }
  .rmc-quickinfo-hook {
    display: flex; align-items: flex-start; gap: 8px;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-style: italic;
    line-height: 1.55; color: var(--text-primary);
  }
  .rmc-quickinfo-hook svg { color: var(--violet); flex-shrink: 0; margin-top: 2px; }
  .rmc-quickinfo-grid {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px;
  }
  .rmc-quickinfo-item { display: flex; gap: 8px; align-items: flex-start; min-width: 0; }
  .rmc-quickinfo-item svg { color: var(--text-subtle); flex-shrink: 0; margin-top: 2px; }
  .rmc-quickinfo-k {
    font-family: 'DM Sans', sans-serif; font-size: 10px; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--text-subtle);
  }
  .rmc-quickinfo-v {
    font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 12px;
    color: var(--text-primary); line-height: 1.4; margin-top: 1px;
  }

  .rmc-rail {
    background: var(--bg-surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 12px 14px;
  }
  .rmc-rail-label {
    font-family: 'DM Sans', sans-serif; font-size: 10.5px;
    text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-subtle);
    margin-bottom: 9px;
  }
  .rmc-rail-pills { display: flex; flex-wrap: wrap; gap: 6px; }
  .rmc-rail-note { font-family: 'DM Sans', sans-serif; font-size: 11px; line-height: 1.5; color: var(--text-subtle); margin-top: 9px; }
  .rmc-pill {
    display: inline-flex; align-items: center; gap: 4px;
    background: var(--bg-elevated); border: 1px solid var(--border);
    border-radius: 999px; padding: 5px 11px; cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 11.5px; color: var(--text-muted);
    transition: border-color 0.12s ease, color 0.12s ease;
  }
  .rmc-pill:hover { border-color: var(--border-light); color: var(--text-primary); }
  .rmc-pill.is-active { border-color: var(--violet); background: var(--violet-tint); color: var(--text-primary); }
  .rmc-pill.is-soon { color: var(--text-subtle); opacity: 0.75; }

  .rmc-lesson-head { margin-bottom: 12px; }
  .rmc-lesson-title {
    font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 18px;
    color: var(--text-primary);
  }
  .rmc-lesson-tag {
    font-family: 'DM Sans', sans-serif; font-size: 12.5px; font-style: italic;
    color: var(--violet); margin-top: 3px;
  }
  .rmc-intro {
    font-family: 'DM Sans', sans-serif; font-size: 13.5px; line-height: 1.7;
    color: var(--text-muted); margin: 0 0 14px;
  }

  .rmc-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--border); margin-bottom: 14px; }
  .rmc-tab {
    background: transparent; border: none; border-bottom: 2px solid transparent;
    padding: 8px 12px; margin-bottom: -1px; cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 12.5px; font-weight: 500;
    color: var(--text-subtle);
  }
  .rmc-tab.is-active { color: var(--text-primary); border-bottom-color: var(--violet); }

  .rmc-h {
    font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 14.5px;
    color: var(--text-primary); margin: 18px 0 7px; scroll-margin-top: 80px;
  }
  .rmc-h:first-child { margin-top: 0; }
  .rmc-p { font-family: 'DM Sans', sans-serif; font-size: 13px; line-height: 1.7; color: var(--text-muted); margin: 0 0 10px; }
  .rmc-quote {
    margin: 12px 0; padding: 10px 14px; border-left: 3px solid var(--violet);
    background: var(--violet-tint); border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-style: italic;
    line-height: 1.6; color: var(--text-primary);
  }
  .rmc-callout {
    display: flex; flex-direction: column; gap: 4px; margin: 14px 0 4px;
    padding: 12px 14px; border: 1px solid rgba(34,211,238,0.28);
    background: var(--cyan-tint); border-radius: var(--radius-sm);
    font-family: 'DM Sans', sans-serif; font-size: 12.5px; line-height: 1.6;
    color: var(--text-primary);
  }
  .rmc-callout-label {
    font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 10.5px;
    text-transform: uppercase; letter-spacing: 0.08em; color: var(--cyan);
  }

  .rmc-check, .rmc-keypoints { list-style: none; margin: 6px 0 12px; padding: 0; display: flex; flex-direction: column; gap: 9px; }
  .rmc-check li, .rmc-keypoints li {
    display: flex; gap: 9px; font-family: 'DM Sans', sans-serif; font-size: 13px;
    line-height: 1.6; color: var(--text-muted);
  }
  .rmc-check li svg, .rmc-keypoints li svg { color: var(--green); flex-shrink: 0; margin-top: 3px; }
  .rmc-check--detailed li span { display: flex; flex-direction: column; gap: 2px; }
  .rmc-check--detailed strong { color: var(--text-primary); font-weight: 600; }
  .rmc-check--detailed em { font-style: normal; font-size: 12px; color: var(--text-subtle); }

  .rmc-examples { display: flex; flex-direction: column; gap: 12px; }
  .rmc-example { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px 14px; }
  .rmc-example-title { font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 12.5px; color: var(--text-primary); margin-bottom: 5px; }
  .rmc-example-text { font-family: 'DM Sans', sans-serif; font-size: 12.5px; line-height: 1.6; color: var(--text-muted); }

  .rmc-soon {
    display: flex; flex-direction: column; align-items: center; text-align: center;
    gap: 8px; padding: 26px 18px; color: var(--text-subtle);
  }
  .rmc-soon--inline { padding: 18px; }
  .rmc-soon-title { font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 14px; color: var(--text-primary); }
  .rmc-soon-body { font-family: 'DM Sans', sans-serif; font-size: 12.5px; line-height: 1.6; color: var(--text-muted); max-width: 380px; }
  .rmc-soon-body strong { color: var(--text-primary); }

  .rmc-continue { align-self: flex-start; }
  .rmc-section-cta { margin-top: 14px; }

  /* Right rail */
  .rmc-side-title {
    font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 12px;
    letter-spacing: 0.04em; text-transform: uppercase; color: var(--text-primary);
    margin-bottom: 10px;
  }
  .rmc-side-empty, .rmc-placeholder {
    font-family: 'DM Sans', sans-serif; font-size: 12px; line-height: 1.6;
    color: var(--text-subtle); margin: 0;
  }
  .rmc-ring-wrap { display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .rmc-ring {
    width: 76px; height: 76px; border-radius: 50%; position: relative;
    display: flex; align-items: center; justify-content: center;
    background: conic-gradient(var(--violet) calc(var(--pct) * 1%), var(--bg-elevated) 0);
    font-family: 'Oxanium', sans-serif; font-weight: 800; font-size: 15px;
    color: var(--text-primary);
  }
  .rmc-ring::after { content: ''; position: absolute; inset: 7px; border-radius: 50%; background: var(--bg-surface); }
  .rmc-ring span { position: relative; z-index: 1; }
  .rmc-ring-caption { font-family: 'DM Sans', sans-serif; font-size: 11px; color: var(--text-subtle); text-align: center; }

  .rmc-jump { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
  .rmc-jump button {
    width: 100%; text-align: left; background: transparent; border: none;
    padding: 7px 8px; border-radius: var(--radius-sm); cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 12.5px; color: var(--text-muted);
  }
  .rmc-jump button:hover { background: var(--bg-elevated); color: var(--text-primary); }

  .rmc-notes { margin-bottom: 6px; font-family: 'DM Sans', sans-serif; resize: vertical; }
  .rmc-notes-foot {
    display: flex; justify-content: space-between; gap: 8px;
    font-family: 'DM Sans', sans-serif; font-size: 10.5px; color: var(--text-subtle);
  }

  .rmc-coach { background: linear-gradient(160deg, rgba(124,58,237,0.10), rgba(59,130,246,0.05)); border-color: rgba(124,58,237,0.25); }
  .rmc-coach-head {
    display: flex; align-items: center; gap: 7px; margin-bottom: 8px;
    font-family: 'Oxanium', sans-serif; font-weight: 700; font-size: 11.5px;
    letter-spacing: 0.05em; text-transform: uppercase; color: var(--violet);
  }
`
