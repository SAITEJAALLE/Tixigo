import { useState } from "react";
import api from "../lib/api";

export default function RequestReset() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e){
    e.preventDefault();
    await api.post("/auth/request-reset", { email });
    setDone(true);
  }

  return (
    <div className="max-w-md mx-auto mt-20">
      <h1 className="text-2xl font-semibold mb-4">Reset your password</h1>
      {done ? (
        <p className="opacity-80">If that email exists, we sent a reset link. Check your inbox.</p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <input className="input" type="email" required placeholder="you@email.com"
                 value={email} onChange={e=>setEmail(e.target.value)} />
          <button className="btn btn-primary" type="submit">Send reset link</button>
        </form>
      )}
    </div>
  );
}
