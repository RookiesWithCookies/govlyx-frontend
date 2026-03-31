import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import AuthLayout from "../components/auth/AuthLayout";
import AuthHeader from "../components/auth/AuthHeader";
import AuthInput from "../components/auth/AuthInput";
import { loginUser } from "../api/authService";
import { Info } from "lucide-react";

const Login = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleLogin = async () => {
    setError(null);

    // Frontend validation
    if (!form.email || !form.password) {
      setError("Email and password are required");
      return;
    }

    setLoading(true);
    try {
      const response = await loginUser({
        email: form.email,
        password: form.password,
      });

      if (response.success && response.data?.token) {
        // Save JWT token to localStorage
        localStorage.setItem("token", response.data.token);

        // Admin Redirect
        if (form.email === "admin@govlyx.com") {
          navigate("/admin/dashboard");
        } else {
          navigate("/");
        }
      } else {
        setError(response.message || "Login failed");
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.message || "Login failed. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <AuthHeader
        title="Welcome back"
        subtitle="Access your Govlyx portal"
      />

      {/* Role Hint */}
      <div className="mb-6 rounded-xl bg-blue-500/5 border border-blue-500/10 p-4">
        <div className="flex items-start gap-3">
          <Info size={16} className="text-blue-500 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-semibold text-blue-500 uppercase tracking-wider">Note for Departments</p>
            <p className="text-[11px] opacity-60 leading-relaxed">
              Public department registration is now closed. Existing bodies use this unified login.
              New officials can request access via the "Become a Department" flow in the citizen feed.
            </p>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Form */}
      <div className="space-y-4">
        <AuthInput
          label="Email Address"
          type="email"
          placeholder="you@example.com"
          name="email"
          value={form.email}
          onChange={handleChange}
        />

        <AuthInput
          label="Password"
          type="password"
          placeholder="••••••••"
          name="password"
          value={form.password}
          onChange={handleChange}
        />

        <button
          className="btn w-full bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed h-12 rounded-xl mt-2 shadow-lg shadow-blue-700/20"
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? "Logging in..." : "Login to Portal"}
        </button>
      </div>

      {/* Footer */}
      <p className="mt-6 text-center text-sm opacity-70">
        Don't have an account?{" "}
        <NavLink
          to="/register"
          className="text-blue-500 font-bold hover:underline"
        >
          Register here
        </NavLink>
      </p>
    </AuthLayout>
  );
};

export default Login;
