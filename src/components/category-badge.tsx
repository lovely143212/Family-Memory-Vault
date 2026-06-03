import { getCategory } from "@/lib/categories";
import { cn } from "@/lib/utils";

export function CategoryBadge({ value, className }: { value: string; className?: string }) {
  const c = getCategory(value);
  const Icon = c.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        className,
      )}
      style={{ borderColor: `${c.color}33`, backgroundColor: `${c.color}14`, color: c.color }}
    >
      <Icon className="h-3 w-3" />
      {c.label}
    </span>
  );
}