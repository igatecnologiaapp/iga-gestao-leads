import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

/** Campo de pesquisa padrão (mesma altura, ícone e acessibilidade em todas as telas). */
export function SearchField({
  value,
  onChange,
  placeholder = "Pesquisar...",
  label = "Pesquisar",
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        type="search"
        className="h-11 pl-9"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
