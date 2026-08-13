import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  PlusCircle,
  Users2,
  Tags,
  Signpost,
  Building2,
  Package,
  Radar,
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
import { useAuth } from "@/hooks/useAuth";

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
      { title: "Produtos / Serviços", url: "/produtos", icon: Package },
      { title: "Ruas", url: "/ruas", icon: Signpost },
      { title: "Bairros", url: "/bairros", icon: Building2 },
      { title: "Empresa emissora", url: "/empresa", icon: Briefcase },
    ],
  },
] as const;



export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const { isAdmin } = useAuth();
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-1 py-2">
          <div className="gradient-brand grid h-9 w-9 shrink-0 place-items-center rounded-xl text-primary-foreground">
            <Radar className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold tracking-tight">LeadField</p>
              <p className="truncate text-[11px] text-muted-foreground">Captação de leads</p>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {groups
          .filter((g) => !("adminOnly" in g && g.adminOnly) || isAdmin)
          .map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items
                    .filter((i) => !("adminOnly" in i && i.adminOnly) || isAdmin)
                    .map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          tooltip={item.title}
                          isActive={pathname === item.url || pathname.startsWith(item.url + "/")}
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
            </SidebarGroup>
          ))}
      </SidebarContent>
    </Sidebar>
  );
}
