import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  PlusCircle,
  Users2,
  Tags,
  Signpost,
  Building2,
  Package,
  FileText,
  Briefcase,
  ChevronDown,
  ShieldCheck,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useAuth } from "@/hooks/useAuth";
import { BrandMark } from "@/components/BrandMark";
import logoAsset from "@/assets/iga-logo.png.asset.json";

const STORAGE_KEY = "sidebar:groups";

const groups = [
  {
    label: "Insights",
    items: [{ title: "Dashboard", url: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Operação",
    items: [
      { title: "Captar Lead", url: "/captar", icon: PlusCircle },
      { title: "Leads", url: "/leads", icon: Users2 },
    ],
  },
  {
    label: "Comercial",
    items: [{ title: "Documentos Comerciais", url: "/comercial", icon: FileText }],
  },
  {
    label: "Cadastros",
    adminOnly: true,
    items: [
      { title: "Segmentos", url: "/segmentos", icon: Tags },
      { title: "Funções / Cargos", url: "/funcoes", icon: BadgeCheck },
      { title: "Produtos / Serviços", url: "/produtos", icon: Package },

      { title: "Ruas", url: "/ruas", icon: Signpost },
      { title: "Bairros", url: "/bairros", icon: Building2 },
      { title: "Empresa emissora", url: "/empresa", icon: Briefcase },
    ],
  },
  {
    label: "Administração",
    adminOnly: true,
    items: [{ title: "Usuários", url: "/usuarios", icon: ShieldCheck }],
  },
] as const;



export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const { isAdmin } = useAuth();
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  // Estado expandido/recolhido de cada grupo, persistido entre sessões.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      setOpenGroups(raw ? (JSON.parse(raw) as Record<string, boolean>) : {});
    } catch {
      setOpenGroups({});
    }
  }, []);

  function toggleGroup(label: string, open: boolean) {
    setOpenGroups((prev) => {
      const next = { ...prev, [label]: open };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* storage indisponível */
      }
      return next;
    });
  }

  const isActive = (url: string) => pathname === url || pathname.startsWith(url + "/");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-1 py-2">
          {collapsed ? (
            <img
              src={logoAsset.url}
              alt="Logotipo IGA Tecnologia"
              className="h-9 w-9 shrink-0 rounded-xl object-contain"
            />
          ) : (
            <BrandMark size="sm" tagline="Captação e Gestão de Leads" />
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {groups
          .filter((g) => !("adminOnly" in g && g.adminOnly) || isAdmin)
          .map((group) => {
            const hasActive = group.items.some((i) => isActive(i.url));
            // Grupo com rota ativa sempre abre; no modo ícone tudo permanece visível.
            const isOpen = collapsed || hasActive || (openGroups[group.label] ?? true);
            return (
              <Collapsible
                key={group.label}
                open={isOpen}
                onOpenChange={(v) => toggleGroup(group.label, v)}
              >
                <SidebarGroup>
                  {!collapsed && (
                    <CollapsibleTrigger className="w-full">
                      <SidebarGroupLabel className="flex w-full cursor-pointer items-center justify-between hover:text-foreground">
                        <span>{group.label}</span>
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${isOpen ? "" : "-rotate-90"}`}
                        />
                      </SidebarGroupLabel>
                    </CollapsibleTrigger>
                  )}
                  <CollapsibleContent>
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {group.items
                          .filter((i) => !("adminOnly" in i && i.adminOnly) || isAdmin)
                          .map((item) => (
                            <SidebarMenuItem key={item.title}>
                              <SidebarMenuButton
                                asChild
                                tooltip={item.title}
                                isActive={isActive(item.url)}
                              >
                                <Link to={item.url} onClick={() => setOpenMobile(false)}>
                                  <item.icon className="h-4 w-4" />
                                  <span>{item.title}</span>
                                </Link>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          ))}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </SidebarGroup>
              </Collapsible>
            );
          })}
      </SidebarContent>
    </Sidebar>
  );
}
