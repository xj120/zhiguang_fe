import { useEffect, useRef, useState } from "react";
import { moderationService } from "@/services/moderationService";
import type { ModerationReason, ModerationTargetType } from "@/types/moderation";
import styles from "./ReportDialog.module.css";

type ReportDialogProps = {
  open: boolean;
  onClose: () => void;
  targetType: ModerationTargetType;
  targetId: string;
  accessToken: string;
};

const REASONS: { value: ModerationReason; label: string }[] = [
  { value: "spam", label: "垃圾信息" },
  { value: "harassment", label: "骚扰/辱骂" },
  { value: "violence", label: "暴力威胁" },
  { value: "pornography", label: "色情低俗" },
  { value: "illegal", label: "违法违规" },
  { value: "other", label: "其它" }
];

const ReportDialog = ({ open, onClose, targetType, targetId, accessToken }: ReportDialogProps) => {
  const [reason, setReason] = useState<ModerationReason | null>(null);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<"form" | "success" | "error">("form");
  const [errorMsg, setErrorMsg] = useState("");
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 重置表单 state（开/关弹窗时）
  useEffect(() => {
    if (open) {
      setReason(null);
      setDescription("");
      setLoading(false);
      setPhase("form");
      setErrorMsg("");
    }
    return () => {
      if (closeTimerRef.current !== null) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [open]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!reason || loading) return;
    setLoading(true);
    setPhase("form");
    setErrorMsg("");
    try {
      const desc = description.trim() ? description.trim().slice(0, 512) : undefined;
      await moderationService.report(
        { targetType, targetId, reason, description: desc },
        accessToken
      );
      // 成功态 1.5s 自动关 + 重置表单
      setPhase("success");
      closeTimerRef.current = setTimeout(() => {
        closeTimerRef.current = null;
        onClose();
      }, 1500);
    } catch (e) {
      setPhase("error");
      setErrorMsg(e instanceof Error ? e.message : "提交失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={phase === "form" ? onClose : undefined}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        {phase === "success" ? (
          <div className={styles.success}>举报已提交，我们会尽快处理</div>
        ) : (
          <>
            <div className={styles.header}>
              <span className={styles.title}>举报</span>
              <button type="button" className={styles.closeBtn} onClick={onClose} disabled={loading}>关闭</button>
            </div>
            <div className={styles.body}>
              <div className={styles.fieldLabel}>选择原因</div>
              <div className={styles.reasonGrid}>
                {REASONS.map(r => (
                  <label key={r.value} className={`${styles.reasonItem} ${reason === r.value ? styles.reasonActive : ""}`}>
                    <input
                      type="radio"
                      name="report-reason"
                      value={r.value}
                      checked={reason === r.value}
                      onChange={() => setReason(r.value)}
                      disabled={loading}
                    />
                    <span>{r.label}</span>
                  </label>
                ))}
              </div>
              <div className={styles.fieldLabel}>备注（可选）</div>
              <textarea
                className={styles.textarea}
                maxLength={512}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="补充说明（≤512 字）"
                disabled={loading}
                rows={3}
              />
              {phase === "error" ? <div className={styles.error}>{errorMsg}</div> : null}
            </div>
            <div className={styles.footer}>
              <button
                type="button"
                className={styles.submitBtn}
                onClick={() => void handleSubmit()}
                disabled={!reason || loading}
              >
                {loading ? "提交中…" : "提交举报"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ReportDialog;
