/* Loading skeleton variants for the 300ms initial flash on data-driven
   surfaces. Visuals live in index.css under .skeleton (shimmer keyframe). */

export function SkeletonStatCard() {
  return (
    <div className="glass clip-corner-sm p-5">
      <div className="skeleton w-8 h-8 mb-3 rounded-md" />
      <div className="skeleton w-28 h-8 mb-2" />
      <div className="skeleton w-32 h-3 mb-1.5" />
      <div className="skeleton w-20 h-3" />
    </div>
  )
}

export function SkeletonDrillRow() {
  return (
    <div className="rounded-md p-3 bg-bg-elevated/40 border border-border">
      <div className="flex items-start gap-3">
        <div className="skeleton w-4 h-4 rounded mt-1" />
        <div className="flex-1 space-y-2">
          <div className="skeleton w-2/3 h-4" />
          <div className="skeleton w-1/2 h-3" />
        </div>
      </div>
      <div className="h-px bg-border my-3" />
      <div className="flex items-center gap-2">
        <div className="skeleton w-24 h-9 rounded-md" />
        <div className="skeleton w-20 h-9 rounded-md" />
      </div>
    </div>
  )
}

export function SkeletonMatchRow() {
  return (
    <div className="flex items-center gap-3 px-3 py-3 border-b border-border">
      <div className="skeleton w-16 h-3" />
      <div className="skeleton w-16 h-5 rounded-full" />
      <div className="skeleton w-20 h-3" />
      <div className="skeleton flex-1 h-3" />
    </div>
  )
}

export function SkeletonText({ width = '100%', height = 12, className = '' }) {
  return (
    <span
      className={`skeleton inline-block ${className}`}
      style={{ width, height }}
    />
  )
}

export function SkeletonAvatar({ size = 36 }) {
  return (
    <div
      className="skeleton rounded-full"
      style={{ width: size, height: size }}
    />
  )
}

export default {
  StatCard: SkeletonStatCard,
  DrillRow: SkeletonDrillRow,
  MatchRow: SkeletonMatchRow,
  Text: SkeletonText,
  Avatar: SkeletonAvatar,
}
