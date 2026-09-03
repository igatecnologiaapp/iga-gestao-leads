import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/PageHeader";
import { LeadSearchPanel } from "@/components/visits/LeadSearchPanel";
import { RoutesPanel } from "@/components/visits/RoutesPanel";
import { VehiclesPanel } from "@/components/visits/VehiclesPanel";

export const Route = createFileRoute("/_authenticated/visitas/")({
  head: () => ({
    meta: [
      { title: "Gestão de Visitas — IGA TECNOLOGIA" },
      {
        name: "description",
        content:
          "Pesquise estabelecimentos por região, importe Leads, planeje roteiros de visitas e controle veículos.",
      },
      { property: "og:title", content: "Gestão de Visitas — IGA TECNOLOGIA" },
      {
        property: "og:description",
        content:
          "Pesquise estabelecimentos por região, importe Leads, planeje roteiros de visitas e controle veículos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VisitasPage,
});

function VisitasPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <PageHeader
        title="Gestão de Visitas"
        description="Pesquisar Leads → Importar → Planejar roteiro → Visitar → Registrar resultado."
      />
      <Tabs defaultValue="pesquisa">
        <TabsList className="flex w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="pesquisa">Pesquisa de Leads</TabsTrigger>
          <TabsTrigger value="roteiros">Roteiros</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="veiculos">Veículos</TabsTrigger>
        </TabsList>
        <TabsContent value="pesquisa" className="mt-4">
          <LeadSearchPanel />
        </TabsContent>
        <TabsContent value="roteiros" className="mt-4">
          <RoutesPanel mode="abertos" />
        </TabsContent>
        <TabsContent value="historico" className="mt-4">
          <RoutesPanel mode="historico" />
        </TabsContent>
        <TabsContent value="veiculos" className="mt-4">
          <VehiclesPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
