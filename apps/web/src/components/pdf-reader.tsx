"use client";

type PdfReaderProps = {
  url: string;
  title: string;
  page: number;
  totalPages?: number;
  onPageChange: (page: number) => void;
};

export function PdfReader({ url, title, page, totalPages, onPageChange }: PdfReaderProps) {
  const viewerUrl = `${url}#page=${page}&toolbar=1&navpanes=0&scrollbar=1&view=FitH`;
  void totalPages;
  void onPageChange;

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-100 dark:bg-[#08080a]">
      <iframe
        key={viewerUrl}
        src={viewerUrl}
        title={title}
        className="min-h-0 flex-1 border-0 bg-white"
      />
    </div>
  );
}
