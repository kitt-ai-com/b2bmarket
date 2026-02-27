import { SessionProvider } from "@/components/providers/session-provider";
import { SellerSidebar } from "@/components/layout/seller-sidebar";
import { TopHeader } from "@/components/layout/top-header";
import { ChatPanel } from "@/components/chat/chat-panel";

export default function SellerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <div className="flex h-screen">
        <SellerSidebar />
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
