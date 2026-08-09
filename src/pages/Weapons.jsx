import WeaponsGuide from '../components/WeaponsGuide.jsx'

/**
 * Dedicated route for the Weapons & Attachments Guide.
 * The inner WeaponsGuide handles its own header, tabs, and card grids
 * (which are already responsive — 1/2/3/4 col + horizontally scrollable
 * filter pills).
 */
export default function Weapons() {
  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      <WeaponsGuide />
    </div>
  )
}
