import logoAsset from "@/assets/iga-logo.png.asset.json";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";

const sizes: Record<Size, { box: string; name: string; tag: string }> = {
  sm: { box: "h-9 w-9", name: "text-sm", tag: "text-[11px]" },
  md: { box: "h-11 w-11 sm:h-12 sm:w-12", name: "text-lg sm:text-xl", tag: "text-xs" },
  lg: { box: "h-14 w-14 sm:h-16 sm:w-16", name: "text-xl sm:text-2xl", tag: "text-sm" },
};

/**
 * Identidade oficial: logotipo IGA à esquerda e o nome imediatamente à direita.
 * Fonte única da marca — reutilizar em login, recuperação de senha e menu lateral.
 */
export function BrandMark({
  size = "md",
  tagline,
  className,
}: {
  size?: Size;
  tagline?: string;
  className?: string;
}) {
  const s = sizes[size];
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <img
        src={logoAsset.url}
        alt="Logotipo IGA Tecnologia"
        className={cn("shrink-0 rounded-xl object-contain", s.box)}
        width={64}
        height={64}
      />
      <div className="min-w-0 text-left">
        <p className={cn("truncate font-extrabold tracking-tight", s.name)}>IGA TECNOLOGIA</p>
        {tagline ? (
          <p className={cn("truncate text-muted-foreground", s.tag)}>{tagline}</p>
        ) : null}
      </div>
    </div>
  );
}
