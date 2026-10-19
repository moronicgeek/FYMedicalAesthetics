// Shown when a locked tablet is asked for a form it wasn't handed over for,
// or the handover is too old.
export function FormClosed() {
  return (
    <div className="card mx-auto max-w-2xl space-y-4 py-10 text-center">
      <h1 className="page-title">This form is not open on this tablet</h1>
      <p className="text-lg">Please hand the tablet back to reception.</p>
    </div>
  );
}
