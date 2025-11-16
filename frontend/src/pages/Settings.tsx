/**
 * Settings page - app configuration
 */
export default function Settings() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>

      <div className="space-y-6">
        {/* General Settings */}
        <section className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">General</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Default FPS</label>
              <select className="border rounded px-3 py-2 w-full max-w-xs">
                <option>24</option>
                <option>30</option>
                <option>60</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Default Resolution</label>
              <select className="border rounded px-3 py-2 w-full max-w-xs">
                <option>1920 × 1080 (Full HD)</option>
                <option>3840 × 2160 (4K)</option>
                <option>1280 × 720 (HD)</option>
              </select>
            </div>
          </div>
        </section>

        {/* Export Settings */}
        <section className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Export</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Default Format</label>
              <select className="border rounded px-3 py-2 w-full max-w-xs">
                <option>MP4</option>
                <option>MOV</option>
                <option>WebM</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Default Quality</label>
              <select className="border rounded px-3 py-2 w-full max-w-xs">
                <option>Ultra</option>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </div>
          </div>
        </section>

        {/* Performance Settings */}
        <section className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Performance</h2>
          <div className="space-y-4">
            <div className="flex items-center">
              <input type="checkbox" id="hardware-accel" className="mr-3" />
              <label htmlFor="hardware-accel" className="text-sm font-medium">
                Enable Hardware Acceleration
              </label>
            </div>
            <div className="flex items-center">
              <input type="checkbox" id="auto-save" className="mr-3" defaultChecked />
              <label htmlFor="auto-save" className="text-sm font-medium">
                Enable Auto-Save
              </label>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
