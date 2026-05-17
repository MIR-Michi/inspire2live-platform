type CommsPlaceholderProps = {
  title: string
  description: string
}

export function CommsPlaceholder({ title, description }: CommsPlaceholderProps) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold text-neutral-900">{title}</h2>
        <p className="max-w-3xl text-sm text-neutral-600">{description}</p>
      </div>

      <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-12">
        <div className="max-w-2xl space-y-3">
          <p className="text-sm font-medium text-neutral-900">Sprint 01 shell is live.</p>
          <p className="text-sm text-neutral-600">
            This route is intentionally a placeholder in Sprint 01. The working workflow
            for this module arrives in the next sprint once the foundation schema,
            permissions, and navigation are in place.
          </p>
        </div>
      </div>
    </section>
  )
}
