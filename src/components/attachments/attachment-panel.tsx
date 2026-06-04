import Image from "next/image";
import { ExternalLink, FileText, ImageIcon, LinkIcon, Plus, Trash2, Upload } from "lucide-react";

import { archiveAttachmentAction, createAttachmentAction } from "@/features/attachments/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Attachment, AttachmentEntityType } from "@/types/database";

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(value));
}

function inferDisplayType(attachment: Attachment) {
  if (attachment.file_type?.trim()) {
    return attachment.file_type.trim();
  }

  try {
    const pathname = new URL(attachment.file_url).pathname;
    const extension = pathname.split(".").pop();
    return extension && extension !== pathname ? extension.toUpperCase() : "Link";
  } catch {
    return "Link";
  }
}

function getAttachmentHref(attachment: Attachment) {
  return attachment.storage_path ? `/api/attachments/${attachment.id}/download` : attachment.file_url;
}

function isImageAttachment(attachment: Attachment) {
  const fileType = attachment.file_type?.toLowerCase() ?? "";

  if (fileType.startsWith("image/")) {
    return true;
  }

  return /\.(jpe?g|png|webp|heic)$/i.test(attachment.file_url);
}

function formatFileSize(size: number | null) {
  if (!size) {
    return null;
  }

  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function AddAttachmentTrigger() {
  return (
    <span className="inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90">
      <Upload className="h-4 w-4" />
      Upload
    </span>
  );
}

export function AttachmentPanel({
  attachments,
  description = "Internal references for this record.",
  entityId,
  entityType,
  title = "Attachments"
}: {
  attachments: Attachment[];
  description?: string;
  entityId: string;
  entityType: AttachmentEntityType;
  title?: string;
}) {
  return (
    <div className="rounded-md border">
      <div className="flex flex-col justify-between gap-3 border-b p-4 sm:flex-row sm:items-start">
        <div>
          <h3 className="font-medium">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <Dialog
          title="Add attachment"
          description="Upload the file now. Add context only when it helps staff."
          className="max-w-xl"
          trigger={<AddAttachmentTrigger />}
        >
          <form action={createAttachmentAction} className="space-y-4">
            <input type="hidden" name="entityType" value={entityType} />
            <input type="hidden" name="entityId" value={entityId} />
            <label
              htmlFor={`attachment-file-${entityId}`}
              className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed bg-muted/20 px-4 py-6 text-center transition hover:bg-muted/40"
            >
              <Upload className="h-6 w-6 text-muted-foreground" />
              <span className="mt-2 text-sm font-medium">Choose a file</span>
              <span className="mt-1 text-xs text-muted-foreground">JPG, PNG, WEBP, HEIC, or PDF. Max 10 MB.</span>
              <Input
                id={`attachment-file-${entityId}`}
                name="file"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                className="mt-4 max-w-sm bg-background"
              />
            </label>
            <div className="grid gap-2">
              <Label htmlFor={`attachment-label-${entityId}`}>Name</Label>
              <Input id={`attachment-label-${entityId}`} name="label" placeholder="Leave blank to use the file name" />
            </div>
            <details className="rounded-md border bg-muted/10 p-3">
              <summary className="cursor-pointer text-sm font-medium">More details</summary>
              <div className="mt-3 space-y-3">
                <div className="grid gap-2">
                  <Label htmlFor={`attachment-notes-${entityId}`}>Notes</Label>
                  <Input id={`attachment-notes-${entityId}`} name="notes" placeholder="Fit note, design context, or why this file matters" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`attachment-url-${entityId}`}>External file URL</Label>
                  <Input id={`attachment-url-${entityId}`} name="fileUrl" type="url" placeholder="https://..." />
                  <p className="text-xs text-muted-foreground">Use only when the file already lives elsewhere.</p>
                </div>
                <label className="flex items-start gap-2 text-sm">
                  <input name="isCustomerVisible" type="checkbox" className="mt-0.5 h-4 w-4" />
                  <span>
                    <span className="block font-medium">Mark safe for customer view later</span>
                    <span className="text-muted-foreground">Stored as a flag. Public tracking still does not show attachments.</span>
                  </span>
                </label>
              </div>
            </details>
            <Button type="submit" className="gap-2">
              <Plus className="h-4 w-4" />
              Save attachment
            </Button>
          </form>
        </Dialog>
      </div>
      <div className={attachments.length ? "grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3" : "p-4"}>
        {attachments.map((attachment) => (
          <div key={attachment.id} className="overflow-hidden rounded-md border bg-background">
            {isImageAttachment(attachment) ? (
              <Dialog
                title={attachment.label ?? "Attachment preview"}
                description={attachment.notes ?? `Added ${formatDateTime(attachment.created_at)}`}
                className="max-w-5xl"
                trigger={
                  <span className="relative block aspect-[4/3] cursor-pointer overflow-hidden bg-muted">
                    <Image
                      src={getAttachmentHref(attachment)}
                      alt={attachment.label ?? "Attachment"}
                      fill
                      sizes="(min-width: 1280px) 18rem, (min-width: 640px) 50vw, 100vw"
                      unoptimized
                      className="object-cover transition hover:scale-[1.02]"
                    />
                  </span>
                }
              >
                <div className="space-y-4">
                  <div className="relative min-h-[60vh] overflow-hidden rounded-md border bg-muted">
                    <Image
                      src={getAttachmentHref(attachment)}
                      alt={attachment.label ?? "Attachment"}
                      fill
                      sizes="90vw"
                      unoptimized
                      className="object-contain"
                    />
                  </div>
                  <AttachmentDetails attachment={attachment} />
                </div>
              </Dialog>
            ) : (
              <a href={getAttachmentHref(attachment)} target="_blank" rel="noreferrer" className="flex aspect-[4/3] items-center justify-center bg-muted/40">
                {attachment.file_type?.includes("pdf") ? <FileText className="h-10 w-10 text-muted-foreground" /> : <LinkIcon className="h-10 w-10 text-muted-foreground" />}
              </a>
            )}
            <div className="space-y-3 p-3">
              <AttachmentDetails attachment={attachment} compact />
              <div className="flex items-center justify-between gap-2">
                <a
                  href={getAttachmentHref(attachment)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Open
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <form action={archiveAttachmentAction}>
                  <input type="hidden" name="attachmentId" value={attachment.id} />
                  <Button type="submit" size="sm" variant="ghost" className="h-8 gap-1 px-2 text-muted-foreground">
                    <Trash2 className="h-4 w-4" />
                    Archive
                  </Button>
                </form>
              </div>
            </div>
          </div>
        ))}
        {!attachments.length ? (
          <div className="text-sm text-muted-foreground">
            No attachments yet. Add measurement photos, design references, bills, or production notes when they help staff avoid guessing.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AttachmentDetails({ attachment, compact = false }: { attachment: Attachment; compact?: boolean }) {
  const icon = isImageAttachment(attachment) ? <ImageIcon className="h-4 w-4 text-muted-foreground" /> : <LinkIcon className="h-4 w-4 text-muted-foreground" />;
  const fileSize = formatFileSize(attachment.file_size_bytes);

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        {icon}
        <p className="truncate font-medium">{attachment.label ?? inferDisplayType(attachment)}</p>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{inferDisplayType(attachment)}</span>
        {fileSize ? <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{fileSize}</span> : null}
        {attachment.is_customer_visible ? <span className="rounded-full bg-neutral-950 px-2 py-0.5 text-xs text-white">customer-safe flag</span> : null}
      </div>
      {attachment.notes ? <p className="mt-2 text-sm text-muted-foreground">{attachment.notes}</p> : null}
      {!compact ? <p className="mt-2 text-xs text-muted-foreground">Added {formatDateTime(attachment.created_at)}</p> : null}
    </div>
  );
}
