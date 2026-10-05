import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function SettingsList<TItem extends { id: string; name: string; is_active?: boolean }>({
  title,
  description,
  items,
  renderMeta,
  renderActions
}: {
  title: string;
  description: string;
  items: TItem[];
  renderMeta?: (item: TItem) => React.ReactNode;
  renderActions?: (item: TItem) => React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex flex-col gap-3 border-b py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 break-words">
              <p className="font-medium">{item.name}</p>
              {renderMeta ? <div className="text-sm text-muted-foreground">{renderMeta(item)}</div> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
              {typeof item.is_active === "boolean" ? (
                <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                  {item.is_active ? "Active" : "Inactive"}
                </span>
              ) : null}
              {renderActions ? renderActions(item) : null}
            </div>
          </div>
        ))}
        {!items.length ? <p className="text-sm text-muted-foreground">No records yet.</p> : null}
      </CardContent>
    </Card>
  );
}
