import { apiFetch } from "./apiClient";
import type { CommentPage, CommentSubmitResponse, CommentLikeResponse, CommentListParams } from "@/types/comment";

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
          clientRequestId: crypto.randomUUID(),
          body
        },
        accessToken
      }
    ),

  like: (commentId: string, accessToken: string) =>
    apiFetch<CommentLikeResponse>(
      `${PREFIX}/comments/${commentId}/like`,
      { method: "POST", accessToken }
    ),

  unlike: (commentId: string, accessToken: string) =>
    apiFetch<CommentLikeResponse>(
      `${PREFIX}/comments/${commentId}/like`,
      { method: "DELETE", accessToken }
    ),

  delete: (commentId: string, accessToken: string) =>
    apiFetch<void>(
      `${PREFIX}/comments/${commentId}`,
      { method: "DELETE", accessToken }
    )
};
