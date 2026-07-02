import { apiFetch } from "./apiClient";
import type { CommentPage, CommentSubmitResponse, CommentListParams } from "@/types/comment";

const PREFIX = "/api/v1";

export const commentService = {
  list: (postId: string, params: CommentListParams = {}, accessToken?: string | null) => {
    const { cursorCreateTime, cursorCommentId, limit = 20 } = params;
    const usp = new URLSearchParams({ limit: String(limit) });
    if (cursorCreateTime) usp.set("cursorCreateTime", cursorCreateTime);
    if (cursorCommentId != null) usp.set("cursorCommentId", String(cursorCommentId));
    return apiFetch<CommentPage>(
      `${PREFIX}/posts/${postId}/comments?${usp.toString()}`,
      { accessToken: accessToken ?? null }
    );
  },

  submit: (postId: string, body: string, accessToken: string) =>
    apiFetch<CommentSubmitResponse>(
      `${PREFIX}/posts/${postId}/comments`,
      {
        method: "POST",
        body: {
          postId: Number(postId),
          clientRequestId: crypto.randomUUID(),
          body
        },
        accessToken
      }
    )
};
