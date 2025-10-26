import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import api from "../lib/api";

export default function ResetPassword() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const token = sp.get("token");
  const [pwd, setPwd] = useState("");
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e){
    e.preventDefault();
    setErr("");
    try {
      await api.post("/auth/reset", { token, password: pwd });
      setOk(true);
      setTimeout(() => nav("/login?reset=1"), 1000);
    } catch {
      setErr("Reset failed. Token may be invalid or expired.");
    }
  }

  useEffect(()=>{ if(!token) setErr("Missing token."); }, [token]);

  return (
    <div className="max-w-md mx-auto mt-20">
      <h1 className="text-2xl font-semibold mb-4">Set a new password</h1>
      {ok ? <p>Password updated! Redirecting…</p> : (
        <form onSubmit={submit} className="space-y-3">
          <input className="input" type="password" required minLength={6}
                 placeholder="New password" value={pwd} onChange={e=>setPwd(e.target.value)} />
          {err && <p className="text-red-600">{err}</p>}
          <button className="btn btn-primary" type="submit" disabled={!token}>Update password</button>
        </form>
      )}
    </div>
  );
}
