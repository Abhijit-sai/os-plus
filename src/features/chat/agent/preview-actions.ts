"use server";
import { previewInquiry } from "./preview-server";
import type { ReplyPreview } from "./preview-core";
export type PreviewActionResult = {
  ok: boolean;
  message: string;
  preview?: ReplyPreview;
};
export async function previewInquiryAction(
  input: unknown,
  key: string,
): Promise<PreviewActionResult> {
  try {
    return {
      ok: true,
      message: "Mock preview recorded. Nothing was sent.",
      preview: await previewInquiry(input, key),
    };
  } catch {
    return {
      ok: false,
      message:
        "Preview could not be confirmed. Check the selected knowledge and your access, then retry the same preview.",
    };
  }
}
