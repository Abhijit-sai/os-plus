export default function Sizes() {
  return (
    <div className="space-y-6">
      <h1>Chat setup viewport QA</h1>
      <p>
        Each frame has its own real CSS viewport. Saves use synthetic fixtures
        only.
      </p>
      <h2>Phone · 375 × 812</h2>
      <iframe
        title="Phone preview"
        src="/"
        width={375}
        height={812}
        className="border"
      />
      <h2>Laptop · 1280 × 900</h2>
      <iframe
        title="Laptop preview"
        src="/"
        width={1280}
        height={900}
        className="border"
      />
    </div>
  );
}
