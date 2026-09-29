import { formatDate } from "@/lib/format";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Icon } from "@/components/ui/icon";

export default function AnnouncementList({
  announcements = [],
  emptyMessage = "There are no updates yet. Check back soon.",
}) {
  if (!announcements.length) {
    return <EmptyState icon="megaphone" title="You are all caught up" description={emptyMessage} />;
  }

  return (
    <div className="divide-y divide-slate-100">
      {announcements.map((announcement) => (
        <article key={announcement.id} className="flex gap-3 py-4 first:pt-0 last:pb-0">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
            <Icon name="megaphone" className="h-4.5 w-4.5" strokeWidth={1.9} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <h3 className="text-sm font-semibold leading-5 text-slate-800">{announcement.title}</h3>
              <time
                dateTime={announcement.created_at}
                className="shrink-0 text-[11px] font-medium tabular-nums text-slate-500"
              >
                {formatDate(announcement.created_at)}
              </time>
            </div>
            <p className="mt-1.5 whitespace-pre-wrap break-words text-[13px] leading-6 text-slate-500">
              {announcement.body}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}