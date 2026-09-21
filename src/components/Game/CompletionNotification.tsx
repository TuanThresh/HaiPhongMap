import type { CompletionNotice } from '../../types/game';

interface CompletionNotificationProps {
  notice: CompletionNotice | null;
}

export function CompletionNotification({ notice }: CompletionNotificationProps) {
  if (!notice) {
    return null;
  }

  return (
    <div className="completion-notification" role="status" aria-live="polite">
      <strong>✅ CHALLENGE COMPLETED</strong>
      <span>Challenge #{notice.challengeNumber}</span>
      <span>{notice.destinationName} reached!</span>
    </div>
  );
}
