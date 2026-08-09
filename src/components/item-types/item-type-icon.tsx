"use client";

import dynamic from "next/dynamic";
import { Shirt } from "lucide-react";

import { getItemTypeIconColorClass } from "@/features/settings/item-type-icon";
import { cn } from "@/lib/utils";

const LazyLucideIcon = dynamic(
  () => import("./item-type-lucide-icon").then((module) => module.ItemTypeLucideIcon),
  {
    ssr: false,
    loading: () => <Shirt aria-hidden="true" className="h-4 w-4 shrink-0" />,
  },
);

export type ItemTypeIconProps = {
  emoji?: string | null;
  kind?: "emoji" | "lucide" | null;
  name?: string | null;
  color?: string | null;
  className?: string;
};

export function ItemTypeIcon({
  emoji,
  kind,
  name,
  color,
  className = "h-4 w-4",
}: ItemTypeIconProps) {
  if ((kind === "emoji" || (!kind && emoji)) && emoji) {
    return <span aria-hidden="true" className="shrink-0 leading-none">{emoji}</span>;
  }

  if (kind === "lucide" && name) {
    return (
      <span className={cn("inline-flex shrink-0", getItemTypeIconColorClass(color))}>
        <LazyLucideIcon name={name} className={cn(className, "shrink-0")} />
      </span>
    );
  }

  return <Shirt aria-hidden="true" className={cn(className, "shrink-0")} />;
}
