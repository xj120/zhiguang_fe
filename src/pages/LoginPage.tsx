import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import type { LoginRequest } from "@/types/auth";
import { authService } from "@/services/authService";
import { ApiError } from "@/services/apiClient";
import styles from "./LoginPage.module.css";

type LocationState = {
  from?: string;
};

type LoginMode = "CODE" | "PASSWORD";
type PasswordIdentifierType = "PHONE" | "EMAIL";

// 后端 BusinessException 一律返 HTTP 400，凭证类错误与格式类错误靠 errorData.code 区分。
// PASSWORD 模式：5xx 服务端故障透传 message（避免把故障误显示为凭证错）；
// 凭证类（INVALID_CREDENTIALS / IDENTIFIER_NOT_FOUND）覆盖统一文案，避免账号枚举；
// 格式类（BAD_REQUEST）透传后端 message；其余回退统一文案。CODE 模式维持透传。
const PASSWORD_FALLBACK = "密码错误或不存在，可使用验证码登录";

const resolveLoginError = (err: unknown, loginMode: LoginMode): string => {
  if (loginMode !== "PASSWORD") {
    return err instanceof Error ? err.message : "登录失败，请稍后重试";
  }
  if (err instanceof ApiError && err.status >= 500) {
    return err.message;
  }
  if (err instanceof ApiError && err.data && typeof err.data === "object" && "code" in err.data) {
    const code = (err.data as { code: string }).code;
    if (code === "INVALID_CREDENTIALS" || code === "IDENTIFIER_NOT_FOUND") {
      return PASSWORD_FALLBACK;
    }
    if (code === "BAD_REQUEST") {
      return err.message;
    }
  }
  return PASSWORD_FALLBACK;
};

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading, user } = useAuth();
  const [loginMode, setLoginMode] = useState<LoginMode>("CODE");
  const [identifierType, setIdentifierType] = useState<PasswordIdentifierType>("PHONE");
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const from = (location.state as LocationState | undefined)?.from ?? "/";

  useEffect(() => {
    if (!isLoading && user) {
      navigate(from, { replace: true });
    }
  }, [isLoading, user, navigate, from]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setTimeout(() => setCountdown(prev => prev - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const payload: LoginRequest =
        loginMode === "PASSWORD"
          ? { identifierType, identifier, password }
          : { identifierType: "PHONE", identifier, code };
      await login(payload);
      navigate(from, { replace: true });
    } catch (err) {
      setError(resolveLoginError(err, loginMode));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendCode = async () => {
    if (!identifier) {
      setError("请先填写账号信息");
      return;
    }
    setError(null);
    setSendingCode(true);
    try {
      const response = await authService.sendCode({
        scene: "LOGIN",
        identifierType: "PHONE",
        identifier
      });
      setCountdown(Math.max(1, response.expireSeconds ?? 300));
    } catch (err) {
      const info = err instanceof Error ? err.message : "验证码发送失败";
      setError(info);
    } finally {
      setSendingCode(false);
    }
  };

  const switchMode = (mode: LoginMode) => {
    if (mode === loginMode) return;
    setLoginMode(mode);
    if (mode === "CODE") {
      setPassword("");
    } else {
      setCode("");
    }
    setError(null);
  };

  const isDisabled =
    submitting || !identifier || (loginMode === "CODE" ? !code : !password);

  const label = loginMode === "PASSWORD" && identifierType === "EMAIL" ? "邮箱" : "手机号";
  const inputType = loginMode === "PASSWORD" && identifierType === "EMAIL" ? "email" : "tel";
  const autoComplete = loginMode === "PASSWORD" && identifierType === "EMAIL" ? "email" : "tel";

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>欢迎回来</h1>
          <p className={styles.subtitle}>登录知光，与知识发光</p>
        </div>

        <div className={styles.tabs} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={loginMode === "CODE"}
            className={`${styles.tab} ${loginMode === "CODE" ? styles.tabActive : ""}`}
            onClick={() => switchMode("CODE")}
          >
            验证码登录
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={loginMode === "PASSWORD"}
            className={`${styles.tab} ${loginMode === "PASSWORD" ? styles.tabActive : ""}`}
            onClick={() => switchMode("PASSWORD")}
          >
            密码登录
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          {loginMode === "PASSWORD" ? (
            <>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="identifierType">
                  账号类型
                </label>
                <select
                  id="identifierType"
                  className={styles.select}
                  value={identifierType}
                  onChange={event => setIdentifierType(event.target.value as PasswordIdentifierType)}
                >
                  <option value="PHONE">手机号</option>
                  <option value="EMAIL">邮箱</option>
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="identifier">
                  {label}
                </label>
                <input
                  id="identifier"
                  className={styles.input}
                  value={identifier}
                  onChange={event => setIdentifier(event.target.value)}
                  placeholder={identifierType === "EMAIL" ? "请输入邮箱" : "请输入手机号"}
                  type={inputType}
                  autoComplete={autoComplete}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="password">
                  登录密码
                </label>
                <input
                  id="password"
                  className={styles.input}
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  placeholder="请输入密码"
                  type="password"
                  autoComplete="current-password"
                />
              </div>
            </>
          ) : (
            <>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="identifier">
                  手机号
                </label>
                <input
                  id="identifier"
                  className={styles.input}
                  value={identifier}
                  onChange={event => setIdentifier(event.target.value)}
                  placeholder="请输入账号"
                  type="tel"
                  autoComplete="tel"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="code">
                  验证码
                </label>
                <div className={styles.codeRow}>
                  <input
                    id="code"
                    className={styles.input}
                    value={code}
                    onChange={event => setCode(event.target.value)}
                    placeholder="请输入验证码"
                    autoComplete="one-time-code"
                  />
                  <button
                    type="button"
                    className={styles.codeButton}
                    disabled={sendingCode || countdown > 0}
                    onClick={handleSendCode}
                  >
                    {countdown > 0 ? `${countdown}s` : "获取验证码"}
                  </button>
                </div>
                <span className={styles.tips}>验证码用于校验登录，不需要输入密码。</span>
              </div>
            </>
          )}

          {error ? <div className={styles.error}>{error}</div> : null}

          <div className={styles.actions}>
            <button type="submit" className={styles.submitButton} disabled={isDisabled}>
              {submitting ? "登录中..." : "登录"}
            </button>
            <div className={styles.switchLink}>
              还没有账号？
              <button
                type="button"
                style={{ background: "none", border: "none", color: "var(--color-primary-strong)", fontWeight: 600, cursor: "pointer" }}
                onClick={() => navigate("/register", { state: { from } })}
              >
                前往注册
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
