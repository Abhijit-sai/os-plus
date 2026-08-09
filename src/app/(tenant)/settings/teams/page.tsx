import Link from "next/link";

import {
  addTeamMemberAction,
  archiveTeamAction,
  createTeamAction,
  removeTeamMemberAction,
  updateTeamAction,
} from "@/features/settings/actions";
import { getTeamsSettings } from "@/features/settings/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AutoCloseActionDialog } from "@/components/ui/auto-close-action-dialog";

function userLabel(user: { display_name: string | null; email: string | null }) {
  return user.display_name ?? user.email ?? "Unnamed user";
}

export default async function TeamsSettingsPage() {
  const { locations, teamMembers, teams, tenantUsers } = await getTeamsSettings();
  const locationById = new Map(locations.map((location) => [location.id, location]));
  const userById = new Map(tenantUsers.map((user) => [user.id, user]));
  const membersByTeamId = teamMembers.reduce((groups, member) => {
    const rows = groups.get(member.team_id) ?? [];
    rows.push(member);
    groups.set(member.team_id, rows);
    return groups;
  }, new Map<string, typeof teamMembers>());

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Add team</CardTitle>
          <CardDescription>
            Teams route operational work. They do not replace role permissions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createTeamAction} className="space-y-4" data-unsaved-guard="true">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="code">Code</Label>
                <Input id="code" name="code" placeholder="WORKSHOP" required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" placeholder="Workshop Intake" required />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="locationId">Location</Label>
              <select id="locationId" name="locationId" defaultValue="" className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">No fixed location</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="description">Description</Label>
              <Input id="description" name="description" placeholder="Optional" />
            </div>
            <Button type="submit">Add team</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
            <div>
              <CardTitle>Teams</CardTitle>
              <CardDescription>{teams.length} operational teams configured.</CardDescription>
            </div>
            <Button asChild variant="outline">
              <Link href="/settings">Back to settings</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {teams.map((team) => {
            const location = team.location_id ? locationById.get(team.location_id) : null;
            const members = membersByTeamId.get(team.id) ?? [];
            const availableUsers = tenantUsers.filter(
              (user) => !members.some((member) => member.tenant_user_id === user.id),
            );

            return (
              <div key={team.id} className="rounded-md border p-4">
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{team.name}</p>
                      <Badge variant="outline">{team.code}</Badge>
                      {location ? <Badge variant="neutral">{location.name}</Badge> : null}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{team.description ?? "No description"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <AutoCloseActionDialog action={updateTeamAction} title="Edit team" description="Memberships and historical task references remain attached to this team." successMessage="Team saved." trigger={<span className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium hover:bg-accent">Edit</span>}>
                        <input type="hidden" name="teamId" value={team.id} />
                        <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label htmlFor={`team-code-${team.id}`}>Code</Label><Input id={`team-code-${team.id}`} name="code" defaultValue={team.code} required /></div><div className="space-y-1"><Label htmlFor={`team-name-${team.id}`}>Name</Label><Input id={`team-name-${team.id}`} name="name" defaultValue={team.name} required /></div></div>
                        <div className="space-y-1"><Label htmlFor={`team-location-${team.id}`}>Location</Label><select id={`team-location-${team.id}`} name="locationId" defaultValue={team.location_id ?? ""} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">No fixed location</option>{locations.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></div>
                        <div className="space-y-1"><Label htmlFor={`team-description-${team.id}`}>Description</Label><Input id={`team-description-${team.id}`} name="description" defaultValue={team.description ?? ""} /></div>
                        <label className="flex items-center gap-2 text-sm"><input name="isActive" type="checkbox" defaultChecked={team.is_active} className="h-4 w-4" />Active</label>
                        <Button type="submit">Save team</Button>
                    </AutoCloseActionDialog>
                    <form><input type="hidden" name="teamId" value={team.id} /><Button type="submit" formAction={archiveTeamAction} variant="outline" size="sm">Archive</Button></form>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
                    <div>
                      <p className="text-sm font-medium">Members</p>
                      <p className="text-xs text-muted-foreground">{members.length} assigned tenant users.</p>
                    </div>
                    <form className="flex flex-col gap-2 sm:flex-row">
                      <input type="hidden" name="teamId" value={team.id} />
                      <select name="tenantUserId" className="h-9 rounded-md border bg-background px-3 text-sm" disabled={!availableUsers.length}>
                        {availableUsers.map((user) => (
                          <option key={user.id} value={user.id}>
                            {userLabel(user)}
                          </option>
                        ))}
                      </select>
                      <Button type="submit" formAction={addTeamMemberAction} size="sm" disabled={!availableUsers.length}>
                        Add member
                      </Button>
                    </form>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {members.map((member) => {
                      const user = userById.get(member.tenant_user_id);

                      return (
                        <form key={member.id} className="inline-flex items-center gap-2 rounded-md border px-2 py-1 text-sm">
                          <input type="hidden" name="teamId" value={team.id} />
                          <input type="hidden" name="tenantUserId" value={member.tenant_user_id} />
                          <span>{user ? userLabel(user) : "Unknown user"}</span>
                          <Button type="submit" formAction={removeTeamMemberAction} variant="ghost" size="sm" className="h-7 px-2 text-xs">Remove</Button>
                        </form>
                      );
                    })}
                    {!members.length ? <p className="text-sm text-muted-foreground">No members assigned.</p> : null}
                  </div>
                </div>
              </div>
            );
          })}
          {!teams.length ? <p className="text-sm text-muted-foreground">No teams configured yet.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
