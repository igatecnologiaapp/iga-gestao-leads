import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Camera, ImageIcon, Loader2, ScanLine, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { readBusinessCard, type BusinessCardData } from "@/lib/businessCard.functions";

const FIELD_LABELS: { key: keyof BusinessCardData; label: string }[] = [
  { key: "company", label: "Nome da empresa" },
  { key: "contact", label: "Nome do contato" },
  { key: "phone", label: "Telefone" },
  { key: "email", label: "E-mail" },
  { key: "segment", label: "Segmento" },
  { key: "website", label: "Site" },
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
  { key: "cep", label: "CEP" },
  { key: "street", label: "Rua" },
  { key: "number", label: "Número" },
  { key: "neighborhood", label: "Bairro" },
  { key: "city", label: "Cidade" },
  { key: "state", label: "UF" },
  { key: "notes", label: "Outras informações" },
];

/** Reduz a imagem antes do envio (economia de banda e tempo de leitura). */
async function toCompactDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const max = 1600;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", 0.82);
}

export function BusinessCardScanner({
  segmentNames,
  onApply,
}: {
  segmentNames: string[];
  onApply: (data: BusinessCardData) => void;
}) {
  const read = useServerFn(readBusinessCard);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fields, setFields] = useState<BusinessCardData | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  function reset() {
    setPreview(null);
    setLoading(false);
    setMessage(null);
    setFields(null);
    setSelected({});
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem.");
      return;
    }
    setFields(null);
    setMessage(null);
    setLoading(true);
    try {
      const image = await toCompactDataUrl(file);
      setPreview(image);
      const result = await read({ data: { image, segments: segmentNames } });
      if (result.status !== "ok") {
        setMessage(result.message);
        return;
      }
      setFields(result.data);
      setSelected(
        Object.fromEntries(
          FIELD_LABELS.map(({ key }) => [key, result.data[key] !== null]),
        ) as Record<string, boolean>,
      );
      setMessage("Confira e ajuste as informações antes de aplicar ao formulário.");
    } catch {
      setMessage("Não foi possível processar a imagem. Tente outra foto ou preencha manualmente.");
    } finally {
      setLoading(false);
    }
  }

  function apply() {
    if (!fields) return;
    const data = Object.fromEntries(
      FIELD_LABELS.map(({ key }) => [key, selected[key] ? fields[key] : null]),
    ) as unknown as BusinessCardData;
    onApply(data);
    setOpen(false);
    reset();
    toast.success("Dados aplicados ao formulário. Revise antes de salvar.");
  }

  return (
    <>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <Button
        type="button"
        variant="outline"
        className="h-11 w-full gap-2 sm:w-auto"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        <ScanLine className="h-4 w-4" aria-hidden="true" />
        Ler Cartão de Visita
      </Button>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) reset();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
              Ler Cartão de Visita
            </DialogTitle>
            <DialogDescription>
              Fotografe ou envie a imagem do cartão. A leitura apenas sugere dados — nenhum lead é
              criado automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                className="h-11 gap-2"
                disabled={loading}
                onClick={() => cameraRef.current?.click()}
              >
                <Camera className="h-4 w-4" aria-hidden="true" /> Tirar foto
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 gap-2"
                disabled={loading}
                onClick={() => fileRef.current?.click()}
              >
                <ImageIcon className="h-4 w-4" aria-hidden="true" /> Escolher imagem
              </Button>
            </div>

            {preview && (
              <img
                src={preview}
                alt="Pré-visualização do cartão de visita enviado"
                className="max-h-44 w-full rounded-xl border object-contain"
              />
            )}

            <p aria-live="polite" className="text-xs text-muted-foreground">
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Lendo o cartão...
                </span>
              ) : (
                message
              )}
            </p>

            {fields && (
              <div className="space-y-3 rounded-xl border p-3">
                {FIELD_LABELS.map(({ key, label }) => {
                  const value = fields[key];
                  if (value === null) return null;
                  return (
                    <div key={key} className="flex items-start gap-3">
                      <Checkbox
                        id={`card-${key}`}
                        className="mt-3"
                        checked={!!selected[key]}
                        onCheckedChange={(v) =>
                          setSelected((prev) => ({ ...prev, [key]: !!v }))
                        }
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <Label htmlFor={`card-${key}-value`} className="text-xs">
                          {label}
                        </Label>
                        <Input
                          id={`card-${key}-value`}
                          className="h-10"
                          value={value}
                          onChange={(e) =>
                            setFields((prev) =>
                              prev ? { ...prev, [key]: e.target.value } : prev,
                            )
                          }
                        />
                      </div>
                    </div>
                  );
                })}
                {FIELD_LABELS.every(({ key }) => fields[key] === null) && (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma informação identificada.
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              className="h-11 w-full"
              disabled={!fields || loading}
              onClick={apply}
            >
              Aplicar ao formulário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
