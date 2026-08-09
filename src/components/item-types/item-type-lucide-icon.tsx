"use client";

import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { Shirt } from "lucide-react";

export function ItemTypeLucideIcon({
  name,
  className,
}: {
  name: string;
  className: string;
}) {
  return (
    <DynamicIcon
      aria-hidden="true"
      className={className}
      name={name as IconName}
      fallback={() => <Shirt aria-hidden="true" className={className} />}
    />
  );
}
