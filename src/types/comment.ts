// 评论相关类型，字段对齐后端 com.tongji.comment.api.dto
// id 类字段（commentId/postId/rootId/parentId/creatorId/pendingCommentId/cursorCommentId）均为 string：
// 后端 snowflake long 超 JS Number.MAX_SAFE_INTEGER，序列化成 number 会丢精度，故后端 DTO 用 String，
// 前端用 string 接收（对齐 KnowPostDetailResponse 的 id 处理模式）。

export type CommentItem = {
  commentId: string;
  postId: string;
  rootId: string | null;
  parentId: string | null;
  creatorId: string;
  body: string;
  status: number; // 后端数字编码（DTO 无注释），MVP 仅透传展示，不过滤
  deleted: boolean;
  likeCount: number;
  replyCount: number;
  createTime: string;
  updateTime: string;
  liked: boolean; // 后端返回当前用户点赞态（本 feature 新增）
};

export type CommentPage = {
  items: CommentItem[];
  nextCursorCreateTime: string | null;
  nextCursorCommentId: string | null;
  hasMore: boolean;
};

export type CommentSubmitResponse = {
  clientRequestId: string;
  pendingCommentId: string;
  status: string; // "accepted"
};

export type CommentLikeResponse = {
  changed: boolean; // 后端只返回 changed，无 liked
};

export type CommentListParams = {
  cursorCreateTime?: string | null;
  cursorCommentId?: string | null;
  limit?: number;
};
