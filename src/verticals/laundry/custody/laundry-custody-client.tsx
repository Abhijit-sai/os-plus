"use client";

import type React from "react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { ClipboardCheck, ClipboardPlus, Loader2, PackageCheck, PackagePlus, PlusCircle, Shirt } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionFeedback } from "@/components/ui/action-feedback-provider";
import { getOrCreateCommandKey, type PendingCommandKey } from "@/core/idempotency/client-command-key";
import {
  completeLaundryPickupRequestAction,
  createLaundryContainerAssetAction,
  createLaundryPickupRequestAction,
  createLaundryServiceAction,
  createLaundryServiceLotAction
} from "@/verticals/laundry/custody/actions";
import type { LaundryHandlingUnitItem, LaundryPickupQueueItem } from "@/verticals/laundry/custody/queries";
import type {
  Customer,
  CustomerAddress,
  LaundryContainerAsset,
  LaundryServiceCatalog,
  Order,
  Team,
  TenantLocation,
  TenantUser,
  Workflow
} from "@/types/database";

type CustodyFormAction = (formData: FormData) => Promise<void>;
type CustomerOption = Pick<Customer, "id" | "name" | "phone">;
type AddressOption = Pick<CustomerAddress, "id" | "customer_id" | "label" | "address_line_1" | "area" | "city">;
type AddressDisplay = Pick<CustomerAddress, "id" | "label" | "address_line_1" | "area" | "city">;
type UserOption = Pick<TenantUser, "id" | "display_name" | "email" | "role">;
type TeamOption = Pick<Team, "id" | "name" | "code">;
type LocationOption = Pick<TenantLocation, "id" | "name" | "code" | "location_type">;
type LaundryOrderOption = Pick<Order, "id" | "order_number" | "customer_id" | "order_date" | "promised_delivery_date" | "runtime_model" | "vertical_key">;
type WorkflowOption = Pick<Workflow, "id" | "name" | "description" | "is_default" | "is_active">;

const pickupStatusLabels: Record<string, string> = {
  REQUESTED: "Requested",
  SCHEDULED: "Scheduled",
  PICKED_UP: "Picked up",
  CANCELLED: "Cancelled"
};

const custodyStatusLabels: Record<string, string> = {
  AT_CUSTOMER: "At customer",
  PICKED_UP: "Picked up",
  AT_STORE: "At store",
  IN_PROCESSING: "In processing",
  READY_FOR_DELIVERY: "Ready",
  DELIVERED: "Delivered",
  LOST: "Lost",
  CANCELLED: "Cancelled"
};

function formatDate(value: string | null) {
  if (!value) {
    return "No date";
  }

  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not scheduled";
  }

  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function customerLabel(customer: CustomerOption | null) {
  if (!customer) {
    return "Unknown customer";
  }

  return customer.phone ? `${customer.name} - ${customer.phone}` : customer.name;
}

function addressLabel(address: AddressDisplay | null) {
  if (!address) {
    return "No saved address";
  }

  return [address.label, address.address_line_1, address.area, address.city].filter(Boolean).join(", ");
}

function userLabel(user: UserOption) {
  return user.display_name ?? user.email ?? user.role;
}

function teamLabel(team: TeamOption) {
  return `${team.name} (${team.code})`;
}

function sortOpenFirst(items: LaundryPickupQueueItem[]) {
  return [...items].sort((a, b) => {
    const aDone = ["PICKED_UP", "CANCELLED"].includes(a.pickup.status);
    const bDone = ["PICKED_UP", "CANCELLED"].includes(b.pickup.status);
    if (aDone !== bDone) {
      return aDone ? 1 : -1;
    }

    return a.pickup.requested_date.localeCompare(b.pickup.requested_date);
  });
}

export function LaundryCustodyClient({
  pickups,
  handlingUnits,
  containerAssets,
  serviceCatalog,
  customers,
  addresses,
  assignableUsers,
  assignableTeams,
  locations,
  laundryOrders,
  workflows
}: {
  pickups: LaundryPickupQueueItem[];
  handlingUnits: LaundryHandlingUnitItem[];
  containerAssets: LaundryContainerAsset[];
  serviceCatalog: LaundryServiceCatalog[];
  customers: CustomerOption[];
  addresses: AddressOption[];
  assignableUsers: UserOption[];
  assignableTeams: TeamOption[];
  locations: LocationOption[];
  laundryOrders: LaundryOrderOption[];
  workflows: WorkflowOption[];
}) {
  const router = useRouter();
  const actionFeedback = useActionFeedback();
  const [pendingCommand, setPendingCommand] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pickupCustomerId, setPickupCustomerId] = useState("");
  const [pickupAddressId, setPickupAddressId] = useState("");
  const pendingCommandRef = useRef<string | null>(null);
  const pendingKeysRef = useRef(new Map<string, PendingCommandKey>());
  const sortedPickups = useMemo(() => sortOpenFirst(pickups), [pickups]);
  const addressesByCustomer = useMemo(() => {
    const map = new Map<string, AddressOption[]>();
    for (const address of addresses) {
      map.set(address.customer_id, [...(map.get(address.customer_id) ?? []), address]);
    }
    return map;
  }, [addresses]);

  async function submitCommand(form: HTMLFormElement, action: CustodyFormAction, commandName: string, idempotencyPrefix: string, resetOnSuccess = false) {
    if (pendingCommandRef.current) {
      return;
    }

    const formData = new FormData(form);
    formData.set("idempotencyKey", getOrCreateCommandKey(pendingKeysRef.current, commandName, idempotencyPrefix, formData));
    pendingCommandRef.current = commandName;
    setPendingCommand(commandName);
    setErrorMessage(null);
    actionFeedback?.startAction("laundry-command", "Saving Laundry update...");

    try {
      await action(formData);
      pendingKeysRef.current.delete(commandName);
      if (resetOnSuccess) {
        form.reset();
        if (commandName === "create-pickup") {
          setPickupCustomerId("");
          setPickupAddressId("");
        }
      }
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Laundry custody command failed.");
    } finally {
      actionFeedback?.finishAction("laundry-command");
      pendingCommandRef.current = null;
      setPendingCommand(null);
    }
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6" aria-busy={pendingCommand !== null}>
      {pendingCommand ? (
        <div className="sticky top-2 z-40 flex items-center justify-center gap-2 rounded-md border bg-background/95 px-4 py-3 text-sm font-medium shadow-sm backdrop-blur">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Saving Laundry update…
        </div>
      ) : null}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Laundry</p>
          <h2 className="text-2xl font-semibold tracking-normal">Custody and intake</h2>
        </div>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <Metric label="Pickups" value={pickups.length} />
          <Metric label="Units" value={handlingUnits.length} />
          <Metric label="Services" value={serviceCatalog.length} />
        </div>
      </div>

      {errorMessage ? <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{errorMessage}</p> : null}

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Create pickup request</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 md:grid-cols-4"
              onSubmit={(event) => {
                event.preventDefault();
                void submitCommand(event.currentTarget, createLaundryPickupRequestAction, "create-pickup", "create-pickup", true);
              }}
            >
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="customerId">Customer</Label>
                <select
                  id="customerId"
                  name="customerId"
                  required
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={pickupCustomerId}
                  onChange={(event) => {
                    setPickupCustomerId(event.target.value);
                    setPickupAddressId("");
                  }}
                >
                  <option value="">Select customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customerLabel(customer)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="requestedDate">Requested date</Label>
                <Input id="requestedDate" name="requestedDate" type="date" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="requestedWindow">Window</Label>
                <Input id="requestedWindow" name="requestedWindow" required placeholder="10 AM - 1 PM" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="pickupAddressId">Saved address</Label>
                <select
                  id="pickupAddressId"
                  name="pickupAddressId"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={pickupAddressId}
                  disabled={!pickupCustomerId}
                  onChange={(event) => setPickupAddressId(event.target.value)}
                >
                  <option value="">No saved address</option>
                  {(addressesByCustomer.get(pickupCustomerId) ?? []).map((address) => (
                    <option key={address.id} value={address.id}>
                      {addressLabel(address)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pickupSource">Source</Label>
                <select id="pickupSource" name="pickupSource" className="h-10 w-full rounded-md border bg-background px-3 text-sm" defaultValue="manual">
                  <option value="manual">Manual</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="call">Call</option>
                  <option value="web">Web</option>
                  <option value="recurring">Recurring</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="scheduledAt">Scheduled at</Label>
                <Input id="scheduledAt" name="scheduledAt" type="datetime-local" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="assignedUserId">User</Label>
                <select id="assignedUserId" name="assignedUserId" className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="">No user</option>
                  {assignableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {userLabel(user)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="assignedTeamId">Team</Label>
                <select id="assignedTeamId" name="assignedTeamId" className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="">No team</option>
                  {assignableTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {teamLabel(team)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Input id="notes" name="notes" placeholder="Gate code, garment count, pickup preference" />
              </div>
              <div className="flex items-end">
                <Button type="submit" className="w-full gap-2" disabled={pendingCommand !== null || !customers.length}>
                  {pendingCommand === "create-pickup" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardPlus className="h-4 w-4" />}
                  {pendingCommand === "create-pickup" ? "Creating…" : "Create"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Register container</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                void submitCommand(event.currentTarget, createLaundryContainerAssetAction, "create-container", "create-container", true);
              }}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="containerCode">Code</Label>
                  <Input id="containerCode" name="containerCode" placeholder="Auto if blank" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="containerType">Type</Label>
                  <select id="containerType" name="containerType" className="h-10 w-full rounded-md border bg-background px-3 text-sm" defaultValue="bag">
                    <option value="bag">Bag</option>
                    <option value="cover">Cover</option>
                    <option value="box">Box</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="assignedCustomerId">Assigned customer</Label>
                <select id="assignedCustomerId" name="assignedCustomerId" className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="">Shared container</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customerLabel(customer)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="containerNotes">Notes</Label>
                <Input id="containerNotes" name="notes" />
              </div>
              <Button type="submit" className="gap-2" disabled={pendingCommand !== null}>
                {pendingCommand === "create-container" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackagePlus className="h-4 w-4" />}
                {pendingCommand === "create-container" ? "Registering…" : "Register"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <PickupQueue
          pickups={sortedPickups}
          locations={locations}
          containerAssets={containerAssets}
          pendingCommand={pendingCommand}
          onSubmit={submitCommand}
        />
        <ServiceCatalogPanel workflows={workflows} services={serviceCatalog} pendingCommand={pendingCommand} onSubmit={submitCommand} />
      </div>

      <HandlingUnitPanel
        handlingUnits={handlingUnits}
        serviceCatalog={serviceCatalog}
        laundryOrders={laundryOrders}
        pendingCommand={pendingCommand}
        onSubmit={submitCommand}
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-24 rounded-md border px-3 py-2 text-right">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

function PickupQueue({
  pickups,
  locations,
  containerAssets,
  pendingCommand,
  onSubmit
}: {
  pickups: LaundryPickupQueueItem[];
  locations: LocationOption[];
  containerAssets: LaundryContainerAsset[];
  pendingCommand: string | null;
  onSubmit: (form: HTMLFormElement, action: CustodyFormAction, commandName: string, idempotencyPrefix: string, resetOnSuccess?: boolean) => Promise<void>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pickup queue</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {pickups.length ? (
          pickups.map((item) => {
            const canComplete = !["PICKED_UP", "CANCELLED"].includes(item.pickup.status);
            const commandName = `complete-pickup-${item.pickup.id}`;
            const compatibleContainers = containerAssets.filter(
              (container) => !container.assigned_customer_id || container.assigned_customer_id === item.pickup.customer_id
            );

            return (
              <div key={item.pickup.id} className="rounded-md border p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md border px-2 py-1 text-xs font-medium">{pickupStatusLabels[item.pickup.status] ?? item.pickup.status}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(item.pickup.requested_date)}</span>
                    </div>
                    <h3 className="mt-2 break-words text-base font-semibold">{customerLabel(item.customer)}</h3>
                    <p className="mt-1 break-words text-sm text-muted-foreground">{addressLabel(item.address)}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {item.pickup.requested_window} - {item.assignedUser ? userLabel(item.assignedUser) : item.assignedTeam ? teamLabel(item.assignedTeam) : "Unassigned"}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDateTime(item.pickup.scheduled_at)}</span>
                </div>

                {canComplete ? (
                  <form
                    className="mt-4 grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void onSubmit(event.currentTarget, completeLaundryPickupRequestAction, commandName, commandName, true);
                    }}
                  >
                    <input type="hidden" name="pickupRequestId" value={item.pickup.id} />
                    <select name="handlingUnitType" className="h-9 rounded-md border bg-background px-2 text-sm" defaultValue="bag">
                      <option value="bag">Bag</option>
                      <option value="cover">Cover</option>
                      <option value="shoe_packet">Shoe packet</option>
                      <option value="carpet">Carpet</option>
                      <option value="curtain_bundle">Curtain bundle</option>
                      <option value="other">Other</option>
                    </select>
                    <select name="currentLocationId" className="h-9 rounded-md border bg-background px-2 text-sm">
                      <option value="">No location</option>
                      {locations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.name}
                        </option>
                      ))}
                    </select>
                    <select name="containerAssetId" className="h-9 rounded-md border bg-background px-2 text-sm">
                      <option value="">No container</option>
                      {compatibleContainers.map((container) => (
                        <option key={container.id} value={container.id}>
                          {container.container_code}
                        </option>
                      ))}
                    </select>
                    <Button type="submit" size="sm" className="gap-2" disabled={pendingCommand !== null}>
                      {pendingCommand === commandName ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
                      {pendingCommand === commandName ? "Completing…" : "Complete"}
                    </Button>
                  </form>
                ) : null}
              </div>
            );
          })
        ) : (
          <p className="rounded-md border p-4 text-sm text-muted-foreground">No pickup requests yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

function ServiceCatalogPanel({
  workflows,
  services,
  pendingCommand,
  onSubmit
}: {
  workflows: WorkflowOption[];
  services: LaundryServiceCatalog[];
  pendingCommand: string | null;
  onSubmit: (form: HTMLFormElement, action: CustodyFormAction, commandName: string, idempotencyPrefix: string, resetOnSuccess?: boolean) => Promise<void>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Service catalog</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <form
          className="grid gap-3 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            void onSubmit(event.currentTarget, createLaundryServiceAction, "create-service", "create-service", true);
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="serviceName">Name</Label>
            <Input id="serviceName" name="name" required placeholder="Dry clean" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="serviceCode">Code</Label>
            <Input id="serviceCode" name="code" required placeholder="DRY" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="defaultWorkflowId">Workflow</Label>
            <select id="defaultWorkflowId" name="defaultWorkflowId" required className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">Select workflow</option>
              {workflows.map((workflow) => (
                <option key={workflow.id} value={workflow.id}>
                  {workflow.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="defaultQuantityUnit">Unit</Label>
            <select id="defaultQuantityUnit" name="defaultQuantityUnit" className="h-10 w-full rounded-md border bg-background px-3 text-sm" defaultValue="unit">
              <option value="unit">Unit</option>
              <option value="piece">Piece</option>
              <option value="pair">Pair</option>
              <option value="kg">Kg</option>
              <option value="sq_ft">Sq ft</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="defaultSlaHours">SLA hours</Label>
            <Input id="defaultSlaHours" name="defaultSlaHours" type="number" min="0" step="1" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="allowsPieceCount" className="h-4 w-4" />
            Pieces
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="allowsWeight" className="h-4 w-4" />
            Weight
          </label>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="serviceDescription">Description</Label>
            <Input id="serviceDescription" name="description" />
          </div>
          <Button type="submit" className="gap-2 md:col-span-2" disabled={pendingCommand !== null || !workflows.length}>
            {pendingCommand === "create-service" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
            {pendingCommand === "create-service" ? "Adding…" : "Add service"}
          </Button>
        </form>

        <div className="grid gap-2">
          {services.length ? (
            services.map((service) => (
              <div key={service.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{service.name}</p>
                  <p className="text-xs text-muted-foreground">{service.code} - {service.default_quantity_unit}</p>
                </div>
                <span className="text-xs text-muted-foreground">{service.default_sla_hours ? `${service.default_sla_hours}h` : "No SLA"}</span>
              </div>
            ))
          ) : (
            <p className="rounded-md border p-3 text-sm text-muted-foreground">No Laundry services configured.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function HandlingUnitPanel({
  handlingUnits,
  serviceCatalog,
  laundryOrders,
  pendingCommand,
  onSubmit
}: {
  handlingUnits: LaundryHandlingUnitItem[];
  serviceCatalog: LaundryServiceCatalog[];
  laundryOrders: LaundryOrderOption[];
  pendingCommand: string | null;
  onSubmit: (form: HTMLFormElement, action: CustodyFormAction, commandName: string, idempotencyPrefix: string, resetOnSuccess?: boolean) => Promise<void>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Handling units</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {handlingUnits.length ? (
          handlingUnits.map((item) => {
            const matchingOrders = laundryOrders.filter((order) => order.customer_id === item.handlingUnit.customer_id);
            const commandName = `create-service-lot-${item.handlingUnit.id}`;

            return (
              <div key={item.handlingUnit.id} className="grid gap-4 rounded-md border p-4 xl:grid-cols-[1fr_440px]">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border px-2 py-1 text-xs font-medium">{custodyStatusLabels[item.handlingUnit.custody_status] ?? item.handlingUnit.custody_status}</span>
                    <span className="text-xs text-muted-foreground">{item.handlingUnit.handling_unit_type.replaceAll("_", " ")}</span>
                  </div>
                  <h3 className="break-words text-base font-semibold">{item.handlingUnit.handling_unit_code}</h3>
                  <p className="text-sm text-muted-foreground">
                    {customerLabel(item.customer)} - {item.currentLocation?.name ?? "No location"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {item.containerAsset ? item.containerAsset.container_code : "No container"} - {item.serviceLots.length} service lots
                  </p>
                  {item.custodyEvents[0] ? (
                    <p className="text-xs text-muted-foreground">
                      Last custody event: {item.custodyEvents[0].event_type.replaceAll("_", " ")} at {formatDateTime(item.custodyEvents[0].occurred_at)}
                    </p>
                  ) : null}
                </div>

                <form
                  className="grid gap-2 md:grid-cols-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void onSubmit(event.currentTarget, createLaundryServiceLotAction, commandName, commandName, true);
                  }}
                >
                  <input type="hidden" name="handlingUnitId" value={item.handlingUnit.id} />
                  <select name="orderId" required className="h-9 rounded-md border bg-background px-2 text-sm">
                    <option value="">Laundry order</option>
                    {matchingOrders.map((order) => (
                      <option key={order.id} value={order.id}>
                        {order.order_number}
                      </option>
                    ))}
                  </select>
                  <select name="serviceCatalogId" required className="h-9 rounded-md border bg-background px-2 text-sm">
                    <option value="">Service</option>
                    {serviceCatalog.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name}
                      </option>
                    ))}
                  </select>
                  <Input name="quantity" type="number" min="0.01" step="0.01" defaultValue="1" aria-label="Quantity" />
                  <select name="quantityUnit" className="h-9 rounded-md border bg-background px-2 text-sm" defaultValue="unit">
                    <option value="unit">Unit</option>
                    <option value="piece">Piece</option>
                    <option value="pair">Pair</option>
                    <option value="kg">Kg</option>
                    <option value="sq_ft">Sq ft</option>
                    <option value="other">Other</option>
                  </select>
                  <Input name="pieceCount" type="number" min="0" step="1" placeholder="Pieces" aria-label="Pieces" />
                  <Input name="weightKg" type="number" min="0" step="0.01" placeholder="Weight kg" aria-label="Weight kg" />
                  <Input name="specialInstructions" placeholder="Instructions" className="md:col-span-2" aria-label="Special instructions" />
                  <Button
                    type="submit"
                    size="sm"
                    className="gap-2 md:col-span-2"
                    disabled={pendingCommand !== null || !serviceCatalog.length || !matchingOrders.length}
                  >
                    {pendingCommand === commandName ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shirt className="h-4 w-4" />}
                    {pendingCommand === commandName ? "Creating…" : "Create service lot"}
                  </Button>
                </form>
              </div>
            );
          })
        ) : (
          <p className="rounded-md border p-4 text-sm text-muted-foreground">No handling units yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
