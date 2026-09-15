import React from 'react'

const toneClassNames = {
  danger: {
    iconWrap: 'bg-[#fff1ee] text-[#e3473c]',
    confirmButton: 'bg-[#e3473c] hover:bg-[#cc3b30] focus:ring-[#ffd6d1]',
  },
}

function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  descriptionTone = 'default',
  sections = [],
  confirmLabel = 'Confirm Delete',
  cancelLabel = 'Cancel',
  isSubmitting = false,
  tone = 'danger',
}) {
  if (!isOpen) return null

  const toneClass = toneClassNames[tone] || toneClassNames.danger
  const descriptionClassName = descriptionTone === 'danger'
    ? 'mt-2 max-w-[560px] text-sm leading-6 text-[#d92d20]'
    : 'mt-2 max-w-[560px] text-sm leading-6 text-[#667085]'

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-[#10131a]/28 px-6 py-10 backdrop-blur-[3px]" onClick={onClose}>
      <div
        className="w-full max-w-[720px] overflow-hidden rounded-[30px] border border-[#e7eaf0] bg-white shadow-[0_28px_90px_rgba(15,23,42,0.18)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-[#eef1f5] bg-[linear-gradient(180deg,#ffffff_0%,#fbfcff_100%)] px-7 py-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${toneClass.iconWrap}`}>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10 11v6m4-6v6M4 7h16M7 7l1-2h8l1 2m-9 0h8l-.8 11.2A2 2 0 0 1 13.2 20h-2.4a2 2 0 0 1-1.99-1.8L8 7Z" />
                </svg>
              </div>
              <div>
                <div className="text-[24px] font-semibold tracking-[-0.02em] text-[#101828]">{title}</div>
                {description ? (
                  <div className={descriptionClassName}>{description}</div>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-[#e5e7eb] bg-white px-3.5 py-2 text-sm font-medium text-[#667085] transition hover:bg-[#f8fafc]"
            >
              关闭
            </button>
          </div>
        </div>

        <div className="space-y-4 px-7 py-6">
          {sections.map((section) => (
            <div key={section.label} className="rounded-[24px] border border-[#eceff4] bg-[#f9fafc] px-5 py-4">
              <div className="text-sm font-semibold text-[#344054]">{section.label}</div>
              <div className="mt-2 text-sm leading-6 text-[#667085] whitespace-pre-line">{section.value}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[#eef1f5] bg-[#fcfcfd] px-7 py-5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-2xl border border-[#e5e7eb] bg-white px-5 py-2.5 text-sm font-medium text-[#475467] transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className={`rounded-2xl px-5 py-2.5 text-sm font-semibold text-white transition focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60 ${toneClass.confirmButton}`}
          >
            {isSubmitting ? '处理中...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default DeleteConfirmModal
