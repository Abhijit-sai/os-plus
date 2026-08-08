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
          <div key={item.id} className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="font-medium">{item.name}</p>
              {renderMeta ? <div className="text-sm text-muted-foreground">{renderMeta(item)}</div> : null}
            </div>
            <div className="flex items-center gap-2">
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
