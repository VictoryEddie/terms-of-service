import { motion } from "framer-motion";
import { X, FileText } from "lucide-react";
import { useEffect, useRef } from "react";
import { Drawer } from "vaul";

interface SourceViewerProps {
  isOpen: boolean;
  onClose: () => void;
  text: string;
  highlightQuote?: string;
}

export function SourceViewer({ isOpen, onClose, text, highlightQuote }: SourceViewerProps) {
  const highlightRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (isOpen && highlightQuote && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isOpen, highlightQuote]);

  const renderContent = () => {
    if (!highlightQuote) return text;

    const parts = text.split(highlightQuote);
    if (parts.length <= 1) return text;

    return (
      <>
        {parts[0]}
        <motion.span
          ref={highlightRef}
          initial={{ backgroundColor: "rgba(239, 68, 68, 0)" }}
          animate={{ backgroundColor: "rgba(239, 68, 68, 0.25)" }}
          className="px-1 rounded border-b-2 border-red-500 font-medium text-red-900 dark:text-white ring-4 ring-red-500/20"
        >
          {highlightQuote}
        </motion.span>
        {parts.slice(1).join(highlightQuote)}
      </>
    );
  };

  return (
    <Drawer.Root
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      shouldScaleBackground
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" />
        <Drawer.Content className="bg-background flex flex-col rounded-t-[32px] mt-24 fixed bottom-0 left-0 right-0 z-50 max-h-[92vh] outline-none border-t border-border">
          <Drawer.Title className="sr-only">Source Text Viewer</Drawer.Title>
          <div className="p-4 bg-background/80 backdrop-blur-xl rounded-t-[32px] flex-1 overflow-y-auto custom-scrollbar">
            <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-foreground/10 mb-8" />

            <div className="max-w-4xl mx-auto">
              {/* Header */}
              <div className="flex items-center justify-between mb-8 px-4 md:px-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground uppercase tracking-wider">
                      Source Text Viewer
                    </h3>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
                      Verifying detected clauses
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Close source viewer"
                  className="p-2 rounded-xl hover:bg-foreground/5 text-muted-foreground hover:text-foreground transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="bg-foreground/[0.02] border border-border rounded-3xl p-6 md:p-8 mb-8 overflow-hidden">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/90 font-medium">
                  {renderContent()}
                </pre>
              </div>

              {/* Footer */}
              <div className="p-4 bg-foreground/[0.03] rounded-2xl border border-border text-[10px] text-muted-foreground text-center italic mb-12">
                Highlights are based on AI pattern matching. Always refer to the original legal document for final context.
              </div>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
