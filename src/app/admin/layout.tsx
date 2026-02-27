import { SessionProvider } from "@/components/providers/session-provider";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { TopHeader } from "@/components/layout/top-header";
import { ChatPanel } from "@/components/chat/chat-panel";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <div className="flex h-screen">
        <AdminSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <TopHeader />
          <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
            {children}
          </main>
        </div>
        <ChatPanel />
      </div>
    </SessionProvider>
  );
}
