import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm mx-auto text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-6">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-red-500"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M15 9l-6 6M9 9l6 6" />
          </svg>
        </div>

        <h1 className="text-xl font-bold text-slate-800 mb-2">
          Access Restricted
        </h1>
        <p className="text-sm text-slate-500 mb-6">
          This application is restricted to Replica team members. If you believe
          this is an error, please contact your team admin.
        </p>

        <Link
          href="/login"
          className="text-sm text-[#A3D600] hover:text-[#8BB800] font-medium"
        >
          Try a different account
        </Link>
      </div>
    </div>
  );
}
