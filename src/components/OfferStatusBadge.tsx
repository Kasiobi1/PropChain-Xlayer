import type { Offer } from "@/lib/mockListings";

const STATUS_STYLES: Record<Offer["status"], string> = {
  Pending: "bg-white text-black",
  Countered: "bg-seal-gold-soft text-ink",
  Accepted: "bg-sage text-white",
  Rejected: "bg-clay text-white",
  Withdrawn: "bg-hairline-dark text-text-secondary",
  Expired: "bg-hairline-dark text-text-secondary",
};

export function OfferStatusBadge({ status }: { status: Offer["status"] }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}
