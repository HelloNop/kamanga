export type Overview = {
  listings: {
    total: number;
    published: number;
    pendingReview: number;
    draft: number;
    rejected: number;
    archived: number;
    // Hanya yang terbit.
    visited: number;
    contactChecked: number;
    unverified: number;
    noWhatsapp: number;
  };
  // 7 hari terakhir.
  chat: {
    sessions: number;
    messages: number;
    clicks: number;
    clickedSessions: number;
    llmCalls: number;
    costUsd: number;
    routes: { template: number; rules: number; llm: number; limit: number; error: number };
  };
  directory: {
    categories: number;
    needs: number;
    cities: number;
    districts: number;
    villages: number;
  };
  // Listing terbit per kelompok utama kategori (terbanyak dulu).
  groups: { name: string; count: number }[];
  // Kategori dengan listing terbit terbanyak.
  topCategories: { name: string; group: string; count: number }[];
  // Pertanyaan warga terbaru beserta jalur jawabannya.
  recentChats: { text: string; route: string | null; at: string }[];
};
