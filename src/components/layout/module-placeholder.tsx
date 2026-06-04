import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ModulePlaceholder({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="text-muted-foreground">{description}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Foundation ready</CardTitle>
          <CardDescription>
            This module will be implemented after tenant, auth, and schema foundations are stable.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No non-MVP integrations or operational features are being built in this foundation pass.
        </CardContent>
      </Card>
    </div>
  );
}
