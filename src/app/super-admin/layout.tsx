import { SessionProvider } from "@/components/providers/session-provider";
import { SuperAdminSidebar } from "@/components/layout/super-admin-sidebar";
import { TopHeader } from "@/components/layout/top-header";

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <div className="flex h-screen">
        <SuperAdminSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <TopHeader />
          <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
            {children}
          </main>
        </div>
      </div>
    </SessionProvider>
  );
}
