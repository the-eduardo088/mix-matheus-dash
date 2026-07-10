import { Download, FileSpreadsheet, FileText, ChevronDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const XLSX_URL = "/segmentacao-clusters-mix-mateus.xlsx";
const XLSX_NAME = "Segmentação Clusters - Mix Mateus.xlsx";

export function DownloadMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="inline-flex items-center gap-2 rounded-full border bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-sm transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Baixar dados"
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Baixar</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-subtitle text-[11px] uppercase tracking-wider text-muted-foreground">
          Exportar base
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href={XLSX_URL} download={XLSX_NAME} className="cursor-pointer gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[color:var(--success)]/12 text-[color:var(--success)]">
              <FileSpreadsheet className="h-4 w-4" />
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-medium">Planilha (Excel)</span>
              <span className="text-[11px] text-muted-foreground">
                Segmentação de clusters · .xlsx
              </span>
            </span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            if (typeof window !== "undefined") window.print();
          }}
          className="cursor-pointer gap-3"
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
            <FileText className="h-4 w-4" />
          </span>
          <span className="flex flex-col">
            <span className="text-sm font-medium">Relatório (PDF)</span>
            <span className="text-[11px] text-muted-foreground">
              Painel atual · imprimir / salvar PDF
            </span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
