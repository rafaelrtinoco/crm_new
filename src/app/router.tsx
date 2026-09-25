import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "@/app/AppShell";
import { RotaProtegida } from "@/app/RotaProtegida";
import { RotaPublica } from "@/app/RotaPublica";
import { Configuracoes } from "@/app/paginas/Configuracoes";
import { Inicio } from "@/app/paginas/Inicio";
import { Marketing } from "@/app/paginas/Marketing";
import { Privacidade } from "@/app/paginas/Privacidade";
import { Termos } from "@/app/paginas/Termos";
import { Entrar } from "@/features/auth/paginas/Entrar";
import { Cadastro } from "@/features/auth/paginas/Cadastro";
import { AceitarConvite } from "@/features/onboarding/paginas/AceitarConvite";
import { Convidar } from "@/features/onboarding/paginas/Convidar";
import { CriarEmpresa } from "@/features/onboarding/paginas/CriarEmpresa";
import { DetalheContato } from "@/features/contatos/paginas/DetalheContato";
import { FormularioContato } from "@/features/contatos/paginas/FormularioContato";
import { ListaContatos } from "@/features/contatos/paginas/ListaContatos";
import { DetalheVencimento } from "@/features/vencimentos/paginas/DetalheVencimento";
import { FormularioVencimento } from "@/features/vencimentos/paginas/FormularioVencimento";
import { ListaVencimentos } from "@/features/vencimentos/paginas/ListaVencimentos";
import { ImportarContatos } from "@/features/importacao/paginas/ImportarContatos";
import { DetalheNegocio } from "@/features/funis/paginas/DetalheNegocio";
import { FormularioNegocio } from "@/features/funis/paginas/FormularioNegocio";
import { Funil } from "@/features/funis/paginas/Funil";
import { ListaTarefas } from "@/features/tarefas/paginas/ListaTarefas";
import { FormularioSegmento } from "@/features/segmentos/paginas/FormularioSegmento";
import { ListaSegmentos } from "@/features/segmentos/paginas/ListaSegmentos";
import { DetalheCampanha } from "@/features/campanhas/paginas/DetalheCampanha";
import { FormularioCampanha } from "@/features/campanhas/paginas/FormularioCampanha";
import { FormularioTemplate } from "@/features/campanhas/paginas/FormularioTemplate";
import { ListaCampanhas } from "@/features/campanhas/paginas/ListaCampanhas";
import { ListaTemplates } from "@/features/campanhas/paginas/ListaTemplates";
import { FormularioFormulario } from "@/features/captura/paginas/FormularioFormulario";
import { FormularioPaginaCaptura } from "@/features/captura/paginas/FormularioPaginaCaptura";
import { FormularioPublico } from "@/features/captura/paginas/FormularioPublico";
import { ListaFormularios } from "@/features/captura/paginas/ListaFormularios";
import { ListaIntegracoes } from "@/features/captura/paginas/ListaIntegracoes";
import { ListaPaginasCaptura } from "@/features/captura/paginas/ListaPaginasCaptura";
import { PaginaCapturaPublica } from "@/features/captura/paginas/PaginaCapturaPublica";
import { RelatorioLeadsOrigem } from "@/features/relatorios/paginas/RelatorioLeadsOrigem";
import { RelatorioDesempenhoCampanhas } from "@/features/relatorios/paginas/RelatorioDesempenhoCampanhas";
import { ConfiguracoesEmpresa } from "@/features/configuracoes/paginas/ConfiguracoesEmpresa";
import { ListaFunis } from "@/features/configuracoes/paginas/ListaFunis";
import { ListaVencimentoTipos } from "@/features/configuracoes/paginas/ListaVencimentoTipos";
import { ListaCamposPersonalizados } from "@/features/configuracoes/paginas/ListaCamposPersonalizados";
import { ListaTags } from "@/features/configuracoes/paginas/ListaTags";
import { ListaMotivosPerda } from "@/features/configuracoes/paginas/ListaMotivosPerda";

export const router = createBrowserRouter([
  {
    element: <RotaPublica />,
    children: [
      { path: "/entrar", element: <Entrar /> },
      { path: "/cadastro", element: <Cadastro /> },
    ],
  },
  { path: "/termos", element: <Termos /> },
  { path: "/privacidade", element: <Privacidade /> },
  { path: "/convite/:token", element: <AceitarConvite /> },
  { path: "/f/:empresaSlug/:formularioId", element: <FormularioPublico /> },
  { path: "/p/:empresaSlug/:paginaSlug", element: <PaginaCapturaPublica /> },
  {
    element: <RotaProtegida />,
    children: [
      { path: "/onboarding", element: <CriarEmpresa /> },
      {
        element: <AppShell />,
        children: [
          { path: "/", element: <Inicio /> },
          { path: "/convidar", element: <Convidar /> },
          { path: "/contatos", element: <ListaContatos /> },
          { path: "/contatos/novo", element: <FormularioContato /> },
          { path: "/contatos/:id", element: <DetalheContato /> },
          { path: "/contatos/:id/editar", element: <FormularioContato /> },
          { path: "/contatos/importar", element: <ImportarContatos /> },
          { path: "/vencimentos", element: <ListaVencimentos /> },
          { path: "/vencimentos/novo", element: <FormularioVencimento /> },
          { path: "/vencimentos/:id", element: <DetalheVencimento /> },
          { path: "/vencimentos/:id/editar", element: <FormularioVencimento /> },
          { path: "/funis", element: <Funil /> },
          { path: "/funis/negocios/novo", element: <FormularioNegocio /> },
          { path: "/funis/negocios/:id", element: <DetalheNegocio /> },
          { path: "/funis/negocios/:id/editar", element: <FormularioNegocio /> },
          { path: "/tarefas", element: <ListaTarefas /> },
          { path: "/segmentos", element: <ListaSegmentos /> },
          { path: "/segmentos/novo", element: <FormularioSegmento /> },
          { path: "/segmentos/:id/editar", element: <FormularioSegmento /> },
          { path: "/marketing", element: <Marketing /> },
          { path: "/campanhas", element: <ListaCampanhas /> },
          { path: "/campanhas/novo", element: <FormularioCampanha /> },
          { path: "/campanhas/templates", element: <ListaTemplates /> },
          { path: "/campanhas/templates/novo", element: <FormularioTemplate /> },
          { path: "/campanhas/templates/:id/editar", element: <FormularioTemplate /> },
          { path: "/campanhas/:id", element: <DetalheCampanha /> },
          { path: "/campanhas/:id/editar", element: <FormularioCampanha /> },
          { path: "/captura/formularios", element: <ListaFormularios /> },
          { path: "/captura/formularios/novo", element: <FormularioFormulario /> },
          { path: "/captura/formularios/:id/editar", element: <FormularioFormulario /> },
          { path: "/captura/paginas", element: <ListaPaginasCaptura /> },
          { path: "/captura/paginas/novo", element: <FormularioPaginaCaptura /> },
          { path: "/captura/paginas/:id/editar", element: <FormularioPaginaCaptura /> },
          { path: "/captura/integracoes", element: <ListaIntegracoes /> },
          { path: "/relatorios/leads-origem", element: <RelatorioLeadsOrigem /> },
          { path: "/relatorios/campanhas", element: <RelatorioDesempenhoCampanhas /> },
          { path: "/configuracoes", element: <Configuracoes /> },
          { path: "/configuracoes/empresa", element: <ConfiguracoesEmpresa /> },
          { path: "/configuracoes/funis", element: <ListaFunis /> },
          { path: "/configuracoes/tipos-vencimento", element: <ListaVencimentoTipos /> },
          {
            path: "/configuracoes/campos-personalizados",
            element: <ListaCamposPersonalizados />,
          },
          { path: "/configuracoes/tags", element: <ListaTags /> },
          { path: "/configuracoes/motivos-perda", element: <ListaMotivosPerda /> },
        ],
      },
    ],
  },
]);
