// 评论相关类型，字段对齐后端 com.tongji.comment.api.dto

export type CommentItem = {
  commentId: number;
  postId: number;
  rootId: number | null;
  parentId: number | null;
  creatorId: number;
  body: string;
  status: number; // 后端数字编码（DTO 无注释），MVP 仅透传展示，不过滤
  deleted: boolean;
  likeCount: number;
  replyCount: number;
  createTime: string;
  updateTime: string;
};

export type CommentPage = {
  items: CommentItem[];
  nextCursorCreateTime: string | null;
  nextCursorCommentId: number | null;
  hasMore: boolean;
};

export type CommentSubmitResponse = {
  clientRequestId: string;
  pendingCommentId: number;
  status: string; // "accepted"
};

export type CommentListParams = {
  cursorCreateTime?: string | null;
  cursorCommentId?: number | null;
  limit?: number;
};
