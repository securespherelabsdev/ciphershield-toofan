import React from 'react';
import { STATUS_SHORT, STATUS_COLORS } from '../workflow';

export default function ConfidenceBadge({ status, score, size = 'md' }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.REVIEW;
  const label = STATUS_SHORT[status] || status;
  const textSize = size === 'sm' ? 'text-xs' : 'text-xs';
  const padding  = size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-full border
        ${textSize} ${padding} ${c.bg} ${c.text} ${c.border}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
      {label}
      {score != null && (
        <span className="opacity-60 font-normal">· {score}</span>
      )}
    </span>
  );
}
